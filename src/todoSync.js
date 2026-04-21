import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export const TODOS_STORAGE_KEY = 'todos';
export const LEGACY_DESKTOP_TODOS_STORAGE_KEY = 'desktop_tasks';
const TODOS_TABLE = 'todos';
const LOCAL_REFRESH_GRACE_MS = 8000;

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
  } catch {
    // Ignore storage write failures and keep the in-memory state alive.
  }
};

const readLocalTodos = (normalizeTodo) => {
  const sharedTodos = readStorageList(TODOS_STORAGE_KEY).map(normalizeTodo);
  const legacyTodos = readStorageList(LEGACY_DESKTOP_TODOS_STORAGE_KEY).map(normalizeTodo);
  return mergeById(sharedTodos, legacyTodos);
};

const toCloudRow = (userId, todo) => {
  const isDeleted = todo.is_deleted === true;
  const payload = { ...todo };
  if ('is_deleted' in payload) delete payload.is_deleted;
  return {
    user_id: userId,
    todo_id: Number(todo.id),
    payload,
    is_deleted: isDeleted,
  };
};

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

const pendingPatches = new Map();
let syncTimeoutRef = null;

const flushPendingTaskPatches = async (userId) => {
  if (pendingPatches.size === 0 || !supabase || !userId) return;

  const patches = Array.from(pendingPatches.values());
  pendingPatches.clear();

  // Read full local tasks to ensure patches are upgraded to full JSONB payloads
  // preventing accidental data loss if a partial patch is flushed via upsert.
  const localTodos = readStorageList(TODOS_STORAGE_KEY);
  const localTaskMap = new Map();
  localTodos.forEach(t => localTaskMap.set(t.id, t));

  const rows = patches.map((patch) => {
    const isDeleted = patch.is_deleted === true;
    
    // Upgrade patch to a full normalized task object
    const existingTask = localTaskMap.get(patch.id) || {};
    const fullPayload = { ...existingTask, ...patch };
    
    if ('is_deleted' in fullPayload) delete fullPayload.is_deleted;
    
    return {
      user_id: userId,
      todo_id: Number(patch.id),
      payload: fullPayload,
      is_deleted: isDeleted,
    };
  });

  try {
    const { error: upsertError } = await supabase
      .from(TODOS_TABLE)
      .upsert(rows, { onConflict: 'user_id,todo_id' });

    if (upsertError) throw upsertError;
  } catch (error) {
    console.error('Failed to sync task patches to Supabase:', error);
  }
};

const scheduleFlush = (userId) => {
  if (syncTimeoutRef) clearTimeout(syncTimeoutRef);
  syncTimeoutRef = setTimeout(() => {
    syncTimeoutRef = null;
    flushPendingTaskPatches(userId);
  }, 350);
};

export const enqueueTaskPatch = (userId, taskId, fields) => {
  if (!userId) return;
  if (!pendingPatches.has(taskId)) {
    pendingPatches.set(taskId, { id: taskId });
  }
  Object.assign(pendingPatches.get(taskId), fields);
  scheduleFlush(userId);
};

export const enqueueTaskBatchPatch = (userId, tasks) => {
  if (!userId) return;
  tasks.forEach((task) => {
    if (!pendingPatches.has(task.id)) {
      pendingPatches.set(task.id, { id: task.id });
    }
    // We expect tasks to be full payload objects or partials
    Object.assign(pendingPatches.get(task.id), task);
  });
  scheduleFlush(userId);
};

export const softDeleteTask = (userId, taskId) => {
  if (!userId) return;
  if (!pendingPatches.has(taskId)) {
    pendingPatches.set(taskId, { id: taskId });
  }
  Object.assign(pendingPatches.get(taskId), { is_deleted: true });
  scheduleFlush(userId);
};

export const useSyncedTodos = ({ userId, normalizeTodo }) => {
  const [todos, setTodosState] = useState(() => readLocalTodos(normalizeTodo));
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const syncTimeoutRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const lastLocalMutationAtRef = useRef(0);

  const setTodos = (nextValue) => {
    lastLocalMutationAtRef.current = Date.now();
    setTodosState(nextValue);
  };

  useEffect(() => {
    const normalizedTodos = todos.map(normalizeTodo);
    writeStorageList(TODOS_STORAGE_KEY, normalizedTodos);
    localStorage.removeItem(LEGACY_DESKTOP_TODOS_STORAGE_KEY);
  }, [normalizeTodo, todos]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const localTodos = readLocalTodos(normalizeTodo);
      if (!cancelled) {
        setTodosState(localTodos);
      }

      if (!userId || !supabase) {
        if (!cancelled) setCloudLoaded(true);
        return;
      }

      try {
        const cloudTodos = await loadCloudTodos(userId, normalizeTodo);
        if (cancelled) return;

        const shouldSeedCloud = cloudTodos.length === 0 && localTodos.length > 0;
        const nextTodos = shouldSeedCloud ? localTodos : cloudTodos;

        if (shouldSeedCloud) {
          enqueueTaskBatchPatch(userId, nextTodos.map(normalizeTodo));
          if (cancelled) return;
        }

        setTodosState(nextTodos);
        writeStorageList(TODOS_STORAGE_KEY, nextTodos);
        setCloudLoaded(true);
      } catch (error) {
        console.error('Failed to load todos from Supabase:', error);
      }
    };

    setCloudLoaded(false);
    hydrate();

    return () => {
      cancelled = true;
    };
  }, [normalizeTodo, userId]);



  useEffect(() => {
    if (!userId || !supabase || !cloudLoaded) return undefined;

    const refreshFromCloud = async () => {
      if (refreshInFlightRef.current || syncTimeoutRef.current) return;
      if (Date.now() - lastLocalMutationAtRef.current < LOCAL_REFRESH_GRACE_MS) return;

      refreshInFlightRef.current = true;
      try {
        const cloudTodos = await loadCloudTodos(userId, normalizeTodo);
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

  return [todos, setTodos];
};
