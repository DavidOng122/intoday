import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createConnectionOperationsForReplacement,
  createDesktopConnection,
  migrateLegacyConnections,
  removeConnectionsForGroupIds,
  rewireConnectionsForPackMerge,
} from '../model/canvasConnections.js';
import { getPackGroupIdFromReactFlowNodeId } from '../adapters/reactFlowAdapter.js';
import {
  hasCompletedConnectionMigration,
  markConnectionMigrationComplete,
  readLegacyConnections,
  readPendingConnectionOperations,
  readWorkspaceConnections,
  writePendingConnectionOperations,
  writeWorkspaceConnections,
} from '../data/connectionStorage.js';
import {
  drainConnectionOperations,
  executeConnectionOperation,
  isConnectionCloudSyncEnabled,
  loadCloudConnections,
  loadCloudConnectionTombstones,
} from '../data/connectionRepository.js';
import { notifySessionVerificationRequired } from '../../session/model/sessionVerification.js';

const createOperationId = () => (
  globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  })
);

const getOperationConnectionId = (operation) => operation.connectionId || operation.connection?.id;

export const useDesktopConnections = ({
  entries,
  onStatus,
  readOnly = false,
  tasks,
  userId,
  workspaceId,
}) => {
  const ownerId = userId || 'guest';
  const canWrite = !readOnly && (!userId || globalThis.navigator?.onLine !== false);
  const cloudEnabled = canWrite && Boolean(userId) && isConnectionCloudSyncEnabled();
  const [connections, setConnections] = useState([]);
  const connectionsRef = useRef([]);
  const entriesRef = useRef(entries);
  const tasksRef = useRef(tasks);
  const pendingOperationsByScopeRef = useRef(new Map());
  const syncInFlightByScopeRef = useRef(new Map());
  const hydratedScopeRef = useRef(null);
  const cloudWriteScopeRef = useRef(null);
  const connectionTombstonesRef = useRef(new Map());
  const syncErrorShownRef = useRef(false);
  const scopeKey = `${ownerId}:${workspaceId}`;
  const cloudScopeKey = `${userId || ''}:${workspaceId}`;
  const hydrationKey = `${scopeKey}:${cloudEnabled ? 'cloud' : 'local'}`;

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const refreshCloudState = useCallback(async () => {
    if (!userId) return;
    try {
      const [cloudConnections, tombstones] = await Promise.all([
        loadCloudConnections(userId, workspaceId),
        loadCloudConnectionTombstones(userId, workspaceId),
      ]);
      connectionTombstonesRef.current = tombstones;
      connectionsRef.current = cloudConnections;
      setConnections(cloudConnections);
      writeWorkspaceConnections(ownerId, workspaceId, cloudConnections);
    } catch (error) {
      notifySessionVerificationRequired(error);
      throw error;
    }
  }, [ownerId, userId, workspaceId]);

  const flushPendingOperations = useCallback(async () => {
    const scopeKey = `${ownerId}:${workspaceId}`;
    const getPendingOperations = () => (
      pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId)
    );
    const setPendingOperations = (operations) => {
      if (!writePendingConnectionOperations(ownerId, workspaceId, operations)) return false;
      pendingOperationsByScopeRef.current.set(scopeKey, operations);
      return true;
    };
    if (!cloudEnabled || !userId) return { remaining: getPendingOperations(), error: null };
    const existingRun = syncInFlightByScopeRef.current.get(scopeKey);
    if (existingRun) return existingRun;

    const run = async () => {
      while (getPendingOperations().length > 0) {
        const queued = getPendingOperations();
        const result = await drainConnectionOperations(
          queued,
          async (operation) => {
            const outcome = await executeConnectionOperation(userId, operation);
            if (Number.isSafeInteger(outcome.revision)) {
              const connectionId = operation.connectionId || operation.connection?.id;
              if (operation.type === 'delete') {
                connectionTombstonesRef.current.set(connectionId, outcome.revision);
              } else {
                connectionTombstonesRef.current.delete(connectionId);
                const nextConnections = connectionsRef.current.map((connection) => (
                  connection.id === connectionId
                    ? { ...connection, revision: outcome.revision }
                    : connection
                ));
                connectionsRef.current = nextConnections;
                setConnections(nextConnections);
                writeWorkspaceConnections(ownerId, workspaceId, nextConnections);
              }
            }
            return outcome;
          },
        );
        const appended = getPendingOperations().slice(queued.length);
        let remaining = [...result.remaining, ...appended];
        if (result.error?.code === 'CONNECTION_CONFLICT') {
          const conflictingOperation = result.remaining[0];
          const conflictId = getOperationConnectionId(conflictingOperation);
          try {
            await refreshCloudState();
          } catch (error) {
            onStatus?.('Connection conflict detected, but the server state could not be refreshed.');
            return { ...result, error, remaining };
          }
          const currentConnection = connectionsRef.current.find((connection) => connection.id === conflictId);
          if (
            conflictingOperation?.type === 'delete'
            && currentConnection
            && (conflictingOperation.rebaseCount || 0) < 2
          ) {
            const rebasedDelete = {
              ...conflictingOperation,
              operationId: createOperationId(),
              expectedRevision: currentConnection.revision,
              rebaseCount: (conflictingOperation.rebaseCount || 0) + 1,
            };
            remaining = [rebasedDelete, ...remaining.slice(1)];
            onStatus?.('A concurrent Connection update was found; the deletion is being retried.');
          } else {
            remaining = remaining.filter((operation) => (
              getOperationConnectionId(operation) !== conflictId
            ));
            onStatus?.('A Connection changed on another device. Its server version was kept; retry your change if needed.');
          }
          if (!setPendingOperations(remaining)) {
            const error = new Error('Connection changes remain queued because the local journal could not be updated.');
            onStatus?.(error.message);
            return { ...result, error, remaining: queued };
          }
          syncErrorShownRef.current = false;
          continue;
        }
        if (!setPendingOperations(remaining)) {
          const error = new Error('Connection changes remain queued because the local journal could not be updated.');
          onStatus?.(error.message);
          return { ...result, error, remaining: queued };
        }
        if (result.error) {
          if (!syncErrorShownRef.current) {
            syncErrorShownRef.current = true;
            onStatus?.('Connection saved locally. Cloud sync will retry.');
          }
          return { ...result, remaining };
        }
        syncErrorShownRef.current = false;
      }
      return { completed: 0, remaining: [], error: null };
    };

    const runPromise = run().finally(() => {
      syncInFlightByScopeRef.current.delete(scopeKey);
    });
    syncInFlightByScopeRef.current.set(scopeKey, runPromise);
    return runPromise;
  }, [cloudEnabled, onStatus, ownerId, refreshCloudState, userId, workspaceId]);

  const enqueueOperations = useCallback((operations) => {
    if (!cloudEnabled || operations.length === 0) return true;
    const scopeKey = `${ownerId}:${workspaceId}`;
    const pending = pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId);
    const nextPending = [...pending, ...operations];
    if (!writePendingConnectionOperations(ownerId, workspaceId, nextPending)) {
      onStatus?.('Connection change was not applied because its local journal could not be saved.');
      return false;
    }
    pendingOperationsByScopeRef.current.set(scopeKey, nextPending);
    void flushPendingOperations();
    return true;
  }, [cloudEnabled, flushPendingOperations, onStatus, ownerId, workspaceId]);

  useEffect(() => {
    if (hydratedScopeRef.current === hydrationKey) return undefined;
    hydratedScopeRef.current = hydrationKey;
    cloudWriteScopeRef.current = null;
    let cancelled = false;

    if (!userId || !cloudEnabled) {
      const stored = readWorkspaceConnections(ownerId, workspaceId);
      const migrated = stored.length > 0
        ? stored
        : migrateLegacyConnections({
          legacyConnections: readLegacyConnections(),
          tasks: tasksRef.current,
          defaultWorkspaceId: workspaceId,
        }).filter((connection) => connection.workspaceId === workspaceId);
      connectionsRef.current = migrated;
      window.queueMicrotask(() => {
        if (!cancelled) setConnections(migrated);
      });
      writeWorkspaceConnections(ownerId, workspaceId, migrated);
      pendingOperationsByScopeRef.current.set(
        scopeKey,
        readPendingConnectionOperations(ownerId, workspaceId),
      );
      return undefined;
    }

    const stored = readWorkspaceConnections(ownerId, workspaceId);
    pendingOperationsByScopeRef.current.set(
      scopeKey,
      readPendingConnectionOperations(ownerId, workspaceId),
    );

    const hydrateCloud = async () => {
      try {
        connectionTombstonesRef.current = await loadCloudConnectionTombstones(userId, workspaceId);
        if (cancelled) return;
        const cloudConnections = await loadCloudConnections(userId, workspaceId);
        if (cancelled) return;

        const migrationCompleted = hasCompletedConnectionMigration(ownerId, workspaceId);
        if (cloudConnections.length === 0 && !migrationCompleted && stored.length > 0) {
          for (const connection of stored) {
            if (connectionTombstonesRef.current.has(connection.id)) continue;
            await executeConnectionOperation(userId, { type: 'upsert', connection });
          }
          markConnectionMigrationComplete(ownerId, workspaceId);
        } else if (cloudConnections.length === 0 && !migrationCompleted && stored.length === 0) {
          markConnectionMigrationComplete(ownerId, workspaceId);
        }

        const finalConnections = await loadCloudConnections(userId, workspaceId);
        const finalTombstones = await loadCloudConnectionTombstones(userId, workspaceId);
        if (cancelled) return;

        connectionTombstonesRef.current = finalTombstones;
        connectionsRef.current = finalConnections;
        setConnections(finalConnections);
        writeWorkspaceConnections(ownerId, workspaceId, finalConnections);
        cloudWriteScopeRef.current = cloudScopeKey;
        void flushPendingOperations();
      } catch (error) {
        notifySessionVerificationRequired(error);
        if (!cancelled && !syncErrorShownRef.current) {
          syncErrorShownRef.current = true;
          onStatus?.('Connection cloud data is unavailable. Using local data.');
        }
      }
    };

    void hydrateCloud();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, cloudScopeKey, flushPendingOperations, hydrationKey, onStatus, ownerId, scopeKey, userId, workspaceId]);

  const replaceConnections = useCallback((updater) => {
    const previous = connectionsRef.current;
    if (!canWrite) return previous;
    if (cloudEnabled && cloudWriteScopeRef.current !== cloudScopeKey) {
      onStatus?.('Connections are still being verified. Please retry in a moment.');
      return previous;
    }
    const next = typeof updater === 'function' ? updater(previous) : updater;
    const operations = createConnectionOperationsForReplacement(
      previous,
      next,
      workspaceId,
      connectionTombstonesRef.current,
    );
    if (cloudEnabled && operations.length > 0 && !enqueueOperations(operations)) return previous;
    connectionsRef.current = next;
    setConnections(next);
    writeWorkspaceConnections(ownerId, workspaceId, next);
    return next;
  }, [canWrite, cloudEnabled, cloudScopeKey, enqueueOperations, onStatus, ownerId, workspaceId]);

  useEffect(() => {
    if (!cloudEnabled || !userId) return undefined;
    const retryAndRefresh = async () => {
      const result = await flushPendingOperations();
      if (result.error || result.remaining.length > 0) return;
      try {
        await refreshCloudState();
      } catch {
        // Keep the local snapshot; the next focus/online event will retry.
      }
    };
    const handleOnline = () => void retryAndRefresh();
    const handleFocus = () => void retryAndRefresh();
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cloudEnabled, flushPendingOperations, refreshCloudState, userId]);

  const removeConnection = useCallback((connectionId) => {
    replaceConnections((current) => current.filter((connection) => connection.id !== connectionId));
  }, [replaceConnections]);

  const rewirePackConnections = useCallback((sourceGroupId, targetGroupId) => {
    replaceConnections((current) => rewireConnectionsForPackMerge(current, {
      workspaceId,
      sourceGroupId,
      targetGroupId,
    }));
  }, [replaceConnections, workspaceId]);

  const removeGroupConnections = useCallback((groupIds) => {
    replaceConnections((current) => removeConnectionsForGroupIds(current, workspaceId, groupIds));
  }, [replaceConnections, workspaceId]);

  const isValidConnection = useCallback((connection) => {
    const sourceGroupId = getPackGroupIdFromReactFlowNodeId(connection?.source);
    const targetGroupId = getPackGroupIdFromReactFlowNodeId(connection?.target);
    const sourceSide = connection?.sourceHandle;
    const targetSide = connection?.targetHandle;
    if (
      !sourceGroupId
      || !targetGroupId
      || sourceGroupId === targetGroupId
      || (sourceSide !== 'left' && sourceSide !== 'right')
      || (targetSide !== 'left' && targetSide !== 'right')
    ) return false;

    const visiblePackIds = new Set(
      entriesRef.current
        .filter((entry) => entry?.type === 'group')
        .map((entry) => String(entry.id)),
    );
    if (!visiblePackIds.has(sourceGroupId) || !visiblePackIds.has(targetGroupId)) return false;

    const candidate = createDesktopConnection({
      workspaceId,
      sourceGroupId,
      sourceSide,
      targetGroupId,
      targetSide,
    });
    return Boolean(candidate) && !connectionsRef.current.some(
      (existingConnection) => existingConnection.id === candidate.id,
    );
  }, [workspaceId]);

  const createConnectionFromFlow = useCallback((flowConnection) => {
    if (!isValidConnection(flowConnection)) return;

    const connection = createDesktopConnection({
      workspaceId,
      sourceGroupId: getPackGroupIdFromReactFlowNodeId(flowConnection.source),
      sourceSide: flowConnection.sourceHandle,
      targetGroupId: getPackGroupIdFromReactFlowNodeId(flowConnection.target),
      targetSide: flowConnection.targetHandle,
    });
    if (!connection) return;

    replaceConnections((current) => (
      current.some((item) => item.id === connection.id) ? current : [...current, connection]
    ));
  }, [isValidConnection, replaceConnections, workspaceId]);

  return {
    connections,
    isValidConnection,
    createConnectionFromFlow,
    removeConnection,
    removeGroupConnections,
    rewirePackConnections,
  };
};
