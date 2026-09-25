import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabase';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage';

export const TODOS_STORAGE_KEY = 'todos';
export const LEGACY_DESKTOP_TODOS_STORAGE_KEY = 'desktop_tasks';
const TODOS_TABLE = 'todos';
const TODOS_CLOUD_MIGRATION_KEY = 'intoday_todos_cloud_migrated';
const LOCAL_REFRESH_GRACE_MS = 8000;
const AUTOSYNC_DELAY_MS = 600;
const AUTOSYNC_RETRY_DELAY_MS = 5000;

const mergeById = (...lists) => {
  const merged = new Map();
  lists.flat().forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    merged.set(item.id, item);
  });
  return Array.from(merged.values());
};

const readStorageList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStorageList = (key, todos) => {
  try {
    localStorage.setItem(key, JSON.stringify(todos));
    return true;
  } catch {
    return false;
  }
};

const getTodoMigrationKey = (userId) => getUserScopedStorageKey(TODOS_CLOUD_MIGRATION_KEY, userId);

const hasTodoCloudMigrationCompleted = (userId) => {
  if (!userId) return true;
  try {
    return localStorage.getItem(getTodoMigrationKey(userId)) === 'true';
  } catch {
    return false;
  }
};

const markTodoCloudMigrationComplete = (userId) => {
  if (!userId) return false;
  try {
    localStorage.setItem(getTodoMigrationKey(userId), 'true');
    return true;
  } catch {
    return false;
  }
};

const readLocalTodos = (userId, normalizeTodo) => {
  if (userId) return [];
  const scopedTodos = readStorageList(getUserScopedStorageKey(TODOS_STORAGE_KEY, userId)).map(normalizeTodo);
  const legacyTodos = readStorageList(LEGACY_DESKTOP_TODOS_STORAGE_KEY).map(normalizeTodo);
  return mergeById(scopedTodos, legacyTodos);
};

const toCloudPayload = (todo) => {
  const {
    localPreviewUrl: _localPreviewUrl,
    uploadState: _uploadState,
    ...payload
  } = todo;

  if (payload.uploadedFileStoragePath) {
    payload.photoDataUrl = null;
    payload.photoUrl = null;
    payload.redirectUrl = null;
  }
  return payload;
};

const toCloudRow = (userId, todo) => ({
  user_id: userId,
  todo_id: Number(todo.id),
  payload: toCloudPayload(todo),
  is_deleted: false,
});

const loadCloudTodos = async (userId, normalizeTodo) => {
  const { data, error } = await supabase
    .from(TODOS_TABLE)
    .select('todo_id, payload')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('todo_id', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => {
    let payload = row.payload;
    if (typeof payload === 'string' && payload.trim().startsWith('{')) {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error('Failed to parse todo payload:', e);
        payload = null;
      }
    }
    return normalizeTodo(payload || { id: row.todo_id });
  });
};

const persistCloudTodos = async (userId, todos) => {
  const rows = todos.map((todo) => toCloudRow(userId, todo));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(TODOS_TABLE)
      .upsert(rows, { onConflict: 'user_id,todo_id' });

    if (upsertError) throw upsertError;
  }

  if (rows.length === 0) {
    const { error: softDeleteAllError } = await supabase
      .from(TODOS_TABLE)
      .update({ is_deleted: true })
      .eq('user_id', userId);

    if (softDeleteAllError) throw softDeleteAllError;
    return;
  }

  const ids = rows.map((row) => row.todo_id).join(',');
  const { error: softDeleteMissingError } = await supabase
    .from(TODOS_TABLE)
    .update({ is_deleted: true })
    .eq('user_id', userId)
    .not('todo_id', 'in', `(${ids})`);

  if (softDeleteMissingError) throw softDeleteMissingError;
};

const persistCloudTodoChanges = async (userId, todos, { upsertIds, deletedIds }) => {
  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
  const rows = upsertIds
    .map((id) => todosById.get(id))
    .filter(Boolean)
    .map((todo) => toCloudRow(userId, todo));

  if (rows.length > 0) {
    const { error } = await supabase
      .from(TODOS_TABLE)
      .upsert(rows, { onConflict: 'user_id,todo_id' });
    if (error) throw error;
  }

  if (deletedIds.length > 0) {
    const { error } = await supabase
      .from(TODOS_TABLE)
      .update({ is_deleted: true })
      .eq('user_id', userId)
      .in('todo_id', deletedIds);
    if (error) throw error;
  }
};

const didTodoChange = (previousTodo, nextTodo) => (
  JSON.stringify(previousTodo) !== JSON.stringify(nextTodo)
);

export const useSyncedTodos = ({ userId, normalizeTodo }) => {
  const [todos, setTodosState] = useState(() => readLocalTodos(userId, normalizeTodo));
  const todosRef = useRef(todos);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const syncTimeoutRef = useRef(null);
  const syncRetryTimeoutRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const lastLocalMutationAtRef = useRef(0);
  const commitQueueRef = useRef(Promise.resolve());
  const skipNextAutosyncRef = useRef(false);
  const mutationVersionRef = useRef(0);
  const pendingUpsertVersionsRef = useRef(new Map());
  const pendingDeleteVersionsRef = useRef(new Map());

  const recordPendingChanges = useCallback((previousTodos, nextTodos) => {
    const previousById = new Map(previousTodos.map((todo) => [todo.id, todo]));
    const nextById = new Map(nextTodos.map((todo) => [todo.id, todo]));

    nextById.forEach((todo, id) => {
      if (!didTodoChange(previousById.get(id), todo)) return;
      const version = ++mutationVersionRef.current;
      pendingUpsertVersionsRef.current.set(id, version);
      pendingDeleteVersionsRef.current.delete(id);
    });

    previousById.forEach((_, id) => {
      if (nextById.has(id)) return;
      const version = ++mutationVersionRef.current;
      pendingDeleteVersionsRef.current.set(id, version);
      pendingUpsertVersionsRef.current.delete(id);
    });
  }, []);

  const setTodos = useCallback((nextValue) => {
    lastLocalMutationAtRef.current = Date.now();
    const previousTodos = todosRef.current;
    const nextTodos = typeof nextValue === 'function' ? nextValue(previousTodos) : nextValue;
    recordPendingChanges(previousTodos, nextTodos);
    todosRef.current = nextTodos;
    setTodosState(nextTodos);
  }, [recordPendingChanges]);

  const commitTodos = useCallback((updater) => {
    const runCommit = async () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      const currentTodos = todosRef.current;
      const nextValue = typeof updater === 'function' ? updater(currentTodos) : updater;
      const nextTodos = nextValue.map(normalizeTodo);

      if (userId && supabase) {
        await persistCloudTodos(userId, nextTodos);
      } else if (!writeStorageList(getUserScopedStorageKey(TODOS_STORAGE_KEY, userId), nextTodos)) {
        throw new Error('Unable to persist the confirmed todo update locally.');
      }

      pendingUpsertVersionsRef.current.clear();
      pendingDeleteVersionsRef.current.clear();

      lastLocalMutationAtRef.current = Date.now();
      todosRef.current = nextTodos;
      skipNextAutosyncRef.current = Boolean(userId && supabase);
      setTodosState(nextTodos);
      return nextTodos;
    };

    const queuedCommit = commitQueueRef.current.then(runCommit, runCommit);
    commitQueueRef.current = queuedCommit.catch(() => undefined);
    return queuedCommit;
  }, [normalizeTodo, userId]);

  useEffect(() => {
    if (userId) return undefined;
    const normalizedTodos = todos.map(normalizeTodo);
    writeStorageList(getUserScopedStorageKey(TODOS_STORAGE_KEY, userId), normalizedTodos);
    return undefined;
  }, [normalizeTodo, todos, userId]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const localTodos = readLocalTodos(userId, normalizeTodo);
      if (!cancelled) {
        todosRef.current = userId ? [] : localTodos;
        setTodosState(userId ? [] : localTodos);
      }

      if (!userId || !supabase) {
        if (!cancelled) setCloudLoaded(true);
        return;
      }

      try {
        const cloudTodos = await loadCloudTodos(userId, normalizeTodo);
        if (cancelled) return;

        const shouldMigrateLegacyData = cloudTodos.length === 0
          && localTodos.length > 0
          && !hasTodoCloudMigrationCompleted(userId);

        if (shouldMigrateLegacyData) {
          await persistCloudTodos(userId, localTodos.map(normalizeTodo));
          markTodoCloudMigrationComplete(userId);
        }

        const nextTodos = await loadCloudTodos(userId, normalizeTodo);
        if (cancelled) return;

        todosRef.current = nextTodos;
        setTodosState(nextTodos);
        setCloudLoaded(true);
      } catch (error) {
        console.error('Failed to load todos from Supabase:', error);
        if (!cancelled) setCloudLoaded(true);
      }
    };

    setCloudLoaded(false);
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [normalizeTodo, userId]);

  useEffect(() => {
    if (!userId || !supabase || !cloudLoaded) return undefined;

    if (skipNextAutosyncRef.current) {
      skipNextAutosyncRef.current = false;
      return undefined;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const upsertVersions = new Map(pendingUpsertVersionsRef.current);
      const deleteVersions = new Map(pendingDeleteVersionsRef.current);
      if (upsertVersions.size === 0 && deleteVersions.size === 0) {
        syncTimeoutRef.current = null;
        return;
      }

      persistCloudTodoChanges(userId, todosRef.current.map(normalizeTodo), {
        upsertIds: [...upsertVersions.keys()],
        deletedIds: [...deleteVersions.keys()],
      }).then(() => {
        upsertVersions.forEach((version, id) => {
          if (pendingUpsertVersionsRef.current.get(id) === version) {
            pendingUpsertVersionsRef.current.delete(id);
          }
        });
        deleteVersions.forEach((version, id) => {
          if (pendingDeleteVersionsRef.current.get(id) === version) {
            pendingDeleteVersionsRef.current.delete(id);
          }
        });
      }).catch((error) => {
        console.error('Failed to sync todo changes to Supabase:', error);
        if (syncRetryTimeoutRef.current === null) {
          syncRetryTimeoutRef.current = setTimeout(() => {
            syncRetryTimeoutRef.current = null;
            setTodosState((currentTodos) => [...currentTodos]);
          }, AUTOSYNC_RETRY_DELAY_MS);
        }
      }).finally(() => {
        syncTimeoutRef.current = null;
      });
    }, AUTOSYNC_DELAY_MS);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [cloudLoaded, normalizeTodo, todos, userId]);

  useEffect(() => () => {
    if (syncRetryTimeoutRef.current) {
      clearTimeout(syncRetryTimeoutRef.current);
      syncRetryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!userId || !supabase || !cloudLoaded) return undefined;

    const refreshFromCloud = async () => {
      if (refreshInFlightRef.current || syncTimeoutRef.current) return;
      if (Date.now() - lastLocalMutationAtRef.current < LOCAL_REFRESH_GRACE_MS) return;

      refreshInFlightRef.current = true;
      try {
        const cloudTodos = await loadCloudTodos(userId, normalizeTodo);
        todosRef.current = cloudTodos;
        setTodosState(cloudTodos);
      } catch (error) {
        console.error('Failed to refresh todos from Supabase:', error);
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    };

    window.addEventListener('focus', refreshFromCloud);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshFromCloud);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cloudLoaded, normalizeTodo, userId]);

  return [todos, setTodos, commitTodos];
};
