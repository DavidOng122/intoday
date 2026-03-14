import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export const TODOS_STORAGE_KEY = 'todos';
export const LEGACY_DESKTOP_TODOS_STORAGE_KEY = 'desktop_tasks';
const TODOS_TABLE = 'todos';

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

const toCloudRow = (userId, todo) => ({
  user_id: userId,
  todo_id: Number(todo.id),
  payload: todo,
});

const loadCloudTodos = async (userId, normalizeTodo) => {
  const { data, error } = await supabase
    .from(TODOS_TABLE)
    .select('todo_id, payload')
    .eq('user_id', userId)
    .order('todo_id', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => normalizeTodo(row.payload || { id: row.todo_id }));
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
    const { error: deleteAllError } = await supabase
      .from(TODOS_TABLE)
      .delete()
      .eq('user_id', userId);

    if (deleteAllError) throw deleteAllError;
    return;
  }

  const ids = rows.map((row) => row.todo_id).join(',');
  const { error: deleteMissingError } = await supabase
    .from(TODOS_TABLE)
    .delete()
    .eq('user_id', userId)
    .not('todo_id', 'in', `(${ids})`);

  if (deleteMissingError) throw deleteMissingError;
};

export const useSyncedTodos = ({ userId, normalizeTodo }) => {
  const [todos, setTodos] = useState(() => readLocalTodos(normalizeTodo));
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const syncTimeoutRef = useRef(null);
  const refreshInFlightRef = useRef(false);

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
        setTodos(localTodos);
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
          await persistCloudTodos(userId, nextTodos.map(normalizeTodo));
          if (cancelled) return;
        }

        setTodos(nextTodos);
        writeStorageList(TODOS_STORAGE_KEY, nextTodos);
        setCloudLoaded(true);
      } catch (error) {
        console.error('Failed to load todos from Supabase:', error);
        if (!cancelled) setCloudLoaded(true);
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

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      persistCloudTodos(userId, todos.map(normalizeTodo)).catch((error) => {
        console.error('Failed to sync todos to Supabase:', error);
      }).finally(() => {
        syncTimeoutRef.current = null;
      });
    }, 350);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [cloudLoaded, normalizeTodo, todos, userId]);

  useEffect(() => {
    if (!userId || !supabase || !cloudLoaded) return undefined;

    const refreshFromCloud = async () => {
      if (refreshInFlightRef.current || syncTimeoutRef.current) return;

      refreshInFlightRef.current = true;
      try {
        const cloudTodos = await loadCloudTodos(userId, normalizeTodo);
        setTodos(cloudTodos);
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
