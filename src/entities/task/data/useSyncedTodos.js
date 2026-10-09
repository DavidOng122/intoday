import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabase';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage';
import { taskMutationJournal } from './todoMutationJournal';
import { createTodoMutationRepository } from './todoMutationRepository';
import { TodoMutationEngine } from './todoMutationEngine';

export const TODOS_STORAGE_KEY = 'todos';
export const LEGACY_DESKTOP_TODOS_STORAGE_KEY = 'desktop_tasks';

const readStorageList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(`Failed to read local task cache "${key}":`, error);
    return [];
  }
};

const writeStorageList = (key, todos) => {
  try {
    localStorage.setItem(key, JSON.stringify(todos));
    return true;
  } catch (error) {
    console.error(`Failed to persist local task cache "${key}":`, error);
    return false;
  }
};

const mergeById = (...lists) => {
  const merged = new Map();
  lists.flat().forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    merged.set(item.id, item);
  });
  return Array.from(merged.values());
};

const readLocalTodos = (userId, normalizeTodo) => {
  if (userId) return [];
  const scopedTodos = readStorageList(getUserScopedStorageKey(TODOS_STORAGE_KEY, userId)).map(normalizeTodo);
  const legacyTodos = readStorageList(LEGACY_DESKTOP_TODOS_STORAGE_KEY).map(normalizeTodo);
  return mergeById(scopedTodos, legacyTodos);
};

const emitTaskSyncError = (error, details = {}) => {
  console.error('Task synchronization failed:', error);
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('intoday:task-sync-error', {
      detail: {
        message: error?.message || 'Task synchronization failed.',
        status: error?.status || null,
        todoId: details.todoId ?? error?.todoId ?? null,
      },
    }));
  }
};

export const useSyncedTodos = ({ userId, normalizeTodo }) => {
  const [todoState, setTodoState] = useState(() => ({
    userId,
    todos: readLocalTodos(userId, normalizeTodo),
  }));
  const [conflictState, setConflictState] = useState(() => ({ userId, conflicts: [] }));
  const todos = todoState.userId === userId
    ? todoState.todos
    : readLocalTodos(userId, normalizeTodo);
  const conflicts = conflictState.userId === userId ? conflictState.conflicts : [];
  const currentUserIdRef = useRef(userId);
  const todosRef = useRef({ userId, todos });
  const engineRef = useRef(null);

  const updateTodos = useCallback((nextTodos, ownerId) => {
    if (currentUserIdRef.current !== ownerId) return;
    todosRef.current = { userId: ownerId, todos: nextTodos };
    setTodoState({ userId: ownerId, todos: nextTodos });
  }, []);

  const updateConflicts = useCallback((nextConflicts, ownerId) => {
    if (currentUserIdRef.current !== ownerId) return;
    setConflictState({ userId: ownerId, conflicts: nextConflicts });
  }, []);

  useLayoutEffect(() => {
    currentUserIdRef.current = userId;
    todosRef.current = {
      userId,
      todos: todoState.userId === userId ? todoState.todos : readLocalTodos(userId, normalizeTodo),
    };
  }, [normalizeTodo, todoState, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      engineRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    if (!supabase) {
      engineRef.current = null;
      emitTaskSyncError(new Error('Supabase is not configured; signed-in task data is unavailable.'));
      return () => {
        cancelled = true;
      };
    }

    const engine = new TodoMutationEngine({
      userId,
      normalizeTodo,
      repository: createTodoMutationRepository({ normalizeTodo }),
      journal: taskMutationJournal,
      onChange: (nextTodos, nextConflicts) => {
        if (!cancelled && engineRef.current === engine) {
          updateTodos(nextTodos, userId);
          updateConflicts(nextConflicts, userId);
        }
      },
      onError: emitTaskSyncError,
    });
    engineRef.current = engine;

    const retry = () => engine.retry();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    void engine.hydrate().then((nextTodos) => {
      if (!cancelled && engineRef.current === engine) {
        updateTodos(nextTodos, userId);
        updateConflicts(engine.getConflicts(), userId);
      }
    }).catch((error) => {
      if (!cancelled) emitTaskSyncError(error);
    });

    return () => {
      cancelled = true;
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [normalizeTodo, updateConflicts, updateTodos, userId]);

  const setTodos = useCallback((valueOrUpdater) => {
    if (userId) {
      const engine = engineRef.current;
      if (!engine || engine.userId !== userId || !supabase) {
        emitTaskSyncError(new Error('Task changes are blocked until authenticated cloud sync is ready.'));
        return;
      }
      void engine.mutate(valueOrUpdater).catch((error) => emitTaskSyncError(error));
      return;
    }

    const currentTodos = todosRef.current.userId === userId
      ? todosRef.current.todos
      : readLocalTodos(userId, normalizeTodo);
    const nextTodos = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(currentTodos)
      : valueOrUpdater;
    if (!Array.isArray(nextTodos)) {
      emitTaskSyncError(new TypeError('Task updates must produce an array.'));
      return;
    }
    updateTodos(nextTodos.map(normalizeTodo), userId);
  }, [normalizeTodo, updateTodos, userId]);

  const commitTodos = useCallback((valueOrUpdater) => {
    if (userId) {
      const engine = engineRef.current;
      if (!engine || engine.userId !== userId || !supabase) {
        return Promise.reject(new Error('Task changes are blocked until authenticated cloud sync is ready.'));
      }
      return engine.mutate(valueOrUpdater);
    }

    const currentTodos = todosRef.current.userId === userId
      ? todosRef.current.todos
      : readLocalTodos(userId, normalizeTodo);
    const nextValue = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(currentTodos)
      : valueOrUpdater;
    if (!Array.isArray(nextValue)) {
      return Promise.reject(new TypeError('Task updates must produce an array.'));
    }
    const nextTodos = nextValue.map(normalizeTodo);
    if (!writeStorageList(getUserScopedStorageKey(TODOS_STORAGE_KEY, userId), nextTodos)) {
      return Promise.reject(new Error('Unable to persist the confirmed task update locally.'));
    }
    updateTodos(nextTodos, userId);
    return Promise.resolve(nextTodos);
  }, [normalizeTodo, updateTodos, userId]);

  const resolveConflict = useCallback((todoId, choice, newTodoId, workspaceId) => {
    const engine = engineRef.current;
    if (!engine || engine.userId !== userId) {
      return Promise.reject(new Error('Task sync is not ready to resolve conflicts.'));
    }
    return engine.resolveConflict(todoId, choice, newTodoId, workspaceId);
  }, [userId]);

  useEffect(() => {
    if (userId) return;
    writeStorageList(
      getUserScopedStorageKey(TODOS_STORAGE_KEY, userId),
      todos.map(normalizeTodo),
    );
  }, [normalizeTodo, todos, userId]);

  return [todos, setTodos, commitTodos, { conflicts, resolveConflict }];
};
