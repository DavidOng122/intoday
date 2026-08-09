import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyConnectionOperations,
  createConnectionOperationsForReplacement,
  createDesktopConnection,
  dedupeDesktopConnections,
  findConnectionTargetAtPoint,
  migrateLegacyConnections,
  removeConnectionsForGroupIds,
  rewireConnectionsForPackMerge,
} from '../model/canvasConnections.js';
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
} from '../data/connectionRepository.js';

export const useDesktopConnections = ({
  entries,
  getCanvasPointFromClient,
  onStatus,
  tasks,
  userId,
  workspaceId,
}) => {
  const ownerId = userId || 'guest';
  const cloudEnabled = Boolean(userId) && isConnectionCloudSyncEnabled();
  const [connections, setConnections] = useState([]);
  const [draftConnection, setDraftConnection] = useState(null);
  const connectionsRef = useRef([]);
  const draftRef = useRef(null);
  const entriesRef = useRef(entries);
  const tasksRef = useRef(tasks);
  const getCanvasPointRef = useRef(getCanvasPointFromClient);
  const rafRef = useRef(null);
  const pendingClientPointRef = useRef(null);
  const listenersRef = useRef(null);
  const pendingOperationsByScopeRef = useRef(new Map());
  const syncInFlightByScopeRef = useRef(new Map());
  const hydratedScopeRef = useRef(null);
  const syncErrorShownRef = useRef(false);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    getCanvasPointRef.current = getCanvasPointFromClient;
  }, [getCanvasPointFromClient]);

  const cleanupPointerListeners = useCallback(() => {
    const listeners = listenersRef.current;
    if (listeners) {
      window.removeEventListener('pointermove', listeners.move);
      window.removeEventListener('pointerup', listeners.end);
      window.removeEventListener('pointercancel', listeners.end);
      listenersRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingClientPointRef.current = null;
  }, []);

  useEffect(() => cleanupPointerListeners, [cleanupPointerListeners]);

  const flushPendingOperations = useCallback(async () => {
    const scopeKey = `${ownerId}:${workspaceId}`;
    const getPendingOperations = () => (
      pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId)
    );
    const setPendingOperations = (operations) => {
      pendingOperationsByScopeRef.current.set(scopeKey, operations);
      writePendingConnectionOperations(ownerId, workspaceId, operations);
    };
    if (!cloudEnabled || !userId) return { remaining: getPendingOperations(), error: null };
    const existingRun = syncInFlightByScopeRef.current.get(scopeKey);
    if (existingRun) return existingRun;

    const run = async () => {
      while (getPendingOperations().length > 0) {
        const queued = getPendingOperations();
        const result = await drainConnectionOperations(
          queued,
          (operation) => executeConnectionOperation(userId, operation),
        );
        const appended = getPendingOperations().slice(queued.length);
        const remaining = [...result.remaining, ...appended];
        setPendingOperations(remaining);
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
  }, [cloudEnabled, onStatus, ownerId, userId, workspaceId]);

  const enqueueOperations = useCallback((operations) => {
    if (!cloudEnabled || operations.length === 0) return;
    const scopeKey = `${ownerId}:${workspaceId}`;
    const pending = pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId);
    const nextPending = [...pending, ...operations];
    pendingOperationsByScopeRef.current.set(scopeKey, nextPending);
    writePendingConnectionOperations(ownerId, workspaceId, nextPending);
    void flushPendingOperations();
  }, [cloudEnabled, flushPendingOperations, ownerId, workspaceId]);

  useEffect(() => {
    const scopeKey = `${ownerId}:${workspaceId}`;
    if (hydratedScopeRef.current === scopeKey) return undefined;
    hydratedScopeRef.current = scopeKey;
    let cancelled = false;
    const stored = dedupeDesktopConnections([
      ...readWorkspaceConnections(ownerId, workspaceId),
      ...(userId ? readWorkspaceConnections('guest', workspaceId) : []),
    ], workspaceId);
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

    if (!cloudEnabled || !userId) return undefined;

    const hydrateCloud = async () => {
      try {
        const cloudConnections = await loadCloudConnections(userId, workspaceId);
        if (cancelled) return;
        let combined = dedupeDesktopConnections([...cloudConnections, ...migrated], workspaceId);
        const migrationCompleted = hasCompletedConnectionMigration(ownerId, workspaceId);
        if (!migrationCompleted) {
          const migrationOperations = createConnectionOperationsForReplacement(
            cloudConnections,
            combined,
            workspaceId,
          );
          const pendingOperations = pendingOperationsByScopeRef.current.get(scopeKey) ?? [];
          const nextPendingOperations = [
            ...pendingOperations,
            ...migrationOperations,
          ];
          pendingOperationsByScopeRef.current.set(scopeKey, nextPendingOperations);
          writePendingConnectionOperations(ownerId, workspaceId, nextPendingOperations);
        }
        combined = applyConnectionOperations(
          combined,
          pendingOperationsByScopeRef.current.get(scopeKey) ?? [],
          workspaceId,
        );
        connectionsRef.current = combined;
        setConnections(combined);
        writeWorkspaceConnections(ownerId, workspaceId, combined);
        const result = await flushPendingOperations();
        if (!cancelled && !result.error && result.remaining.length === 0) {
          markConnectionMigrationComplete(ownerId, workspaceId);
        }
      } catch {
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
  }, [cloudEnabled, flushPendingOperations, onStatus, ownerId, userId, workspaceId]);

  const replaceConnections = useCallback((updater) => {
    const previous = connectionsRef.current;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    const operations = createConnectionOperationsForReplacement(previous, next, workspaceId);
    connectionsRef.current = next;
    setConnections(next);
    writeWorkspaceConnections(ownerId, workspaceId, next);
    enqueueOperations(operations);
    return next;
  }, [enqueueOperations, ownerId, workspaceId]);

  useEffect(() => {
    if (!cloudEnabled || !userId) return undefined;
    const retryAndRefresh = async () => {
      const result = await flushPendingOperations();
      if (result.error || result.remaining.length > 0) return;
      try {
        const cloudConnections = await loadCloudConnections(userId, workspaceId);
        connectionsRef.current = cloudConnections;
        setConnections(cloudConnections);
        writeWorkspaceConnections(ownerId, workspaceId, cloudConnections);
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
  }, [cloudEnabled, flushPendingOperations, ownerId, userId, workspaceId]);

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

  const finishConnectionDrag = useCallback((event) => {
    const draft = draftRef.current;
    cleanupPointerListeners();
    draftRef.current = null;
    setDraftConnection(null);
    if (!draft || event?.type === 'pointercancel') return;

    const toCanvasPoint = getCanvasPointRef.current;
    const canvasPoint = typeof toCanvasPoint === 'function'
      ? toCanvasPoint(event.clientX, event.clientY)
      : null;
    const target = findConnectionTargetAtPoint(entriesRef.current, canvasPoint);
    if (!target || target.targetGroupId === draft.sourceGroupId) return;

    const connection = createDesktopConnection({
      workspaceId,
      sourceGroupId: draft.sourceGroupId,
      sourceSide: draft.sourceSide,
      targetGroupId: target.targetGroupId,
      targetSide: target.targetSide,
    });
    if (!connection) return;
    replaceConnections((current) => (
      current.some((item) => item.id === connection.id) ? current : [...current, connection]
    ));
  }, [cleanupPointerListeners, replaceConnections, workspaceId]);

  const scheduleDraftPoint = useCallback((clientX, clientY) => {
    pendingClientPointRef.current = { x: clientX, y: clientY };
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const point = pendingClientPointRef.current;
      pendingClientPointRef.current = null;
      if (!point || !draftRef.current) return;
      const nextDraft = { ...draftRef.current, currentClientPt: point };
      draftRef.current = nextDraft;
      setDraftConnection(nextDraft);
    });
  }, []);

  const startConnectionDrag = useCallback((groupId, side, event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    cleanupPointerListeners();

    const draft = {
      sourceGroupId: groupId,
      sourceSide: side,
      currentClientPt: { x: event.clientX, y: event.clientY },
    };
    draftRef.current = draft;
    setDraftConnection(draft);

    const move = (moveEvent) => scheduleDraftPoint(moveEvent.clientX, moveEvent.clientY);
    const end = (endEvent) => finishConnectionDrag(endEvent);
    listenersRef.current = { move, end };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }, [cleanupPointerListeners, finishConnectionDrag, scheduleDraftPoint]);

  return {
    connections,
    draftConnection,
    removeConnection,
    removeGroupConnections,
    rewirePackConnections,
    startConnectionDrag,
  };
};
