import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabase';
import { getUserScopedStorageKey } from '../../../shared/storage/userScopedStorage';
import { notifySessionVerificationRequired } from '../../../features/session/model/sessionVerification.js';
import { taskMutationJournal } from './todoMutationJournal';
import { createTodoMutationRepository } from './todoMutationRepository';
import { TodoMutationEngine } from './todoMutationEngine';

export const TODOS_STORAGE_KEY = 'todos';
export const LEGACY_DESKTOP_TODOS_STORAGE_KEY = 'desktop_tasks';
export const CONFIRMED_TODOS_STORAGE_KEY = 'confirmed_todos_v1';

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
  const scopedTodos = readStorageList(getUserScopedStorageKey(
    userId ? CONFIRMED_TODOS_STORAGE_KEY : TODOS_STORAGE_KEY,
    userId,
  )).map(normalizeTodo);
  if (userId) return scopedTodos;
  const legacyTodos = readStorageList(LEGACY_DESKTOP_TODOS_STORAGE_KEY).map(normalizeTodo);
  return mergeById(scopedTodos, legacyTodos);
};

const emitTaskSyncError = (error, details = {}) => {
  console.error('Task synchronization failed:', error);
  if (
    error?.status === 401
    || error?.status === 403
    || error?.name === 'TypeError'
  ) {
    notifySessionVerificationRequired(error);
  }
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

export const useSyncedTodos = ({ userId, normalizeTodo, readOnly = false }) => {
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
      onChange: (nextTodos, nextConflicts, confirmedTodos) => {
        if (!cancelled && engineRef.current === engine) {
          updateTodos(nextTodos, userId);
          updateConflicts(nextConflicts, userId);
          writeStorageList(
            getUserScopedStorageKey(CONFIRMED_TODOS_STORAGE_KEY, userId),
            confirmedTodos,
          );
        }
      },
      onError: emitTaskSyncError,
      isOnline: () => !readOnly && globalThis.navigator?.onLine !== false,
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
  }, [normalizeTodo, readOnly, updateConflicts, updateTodos, userId]);

  const setTodos = useCallback((valueOrUpdater) => {
    if (readOnly) {
      emitTaskSyncError(new Error('Task changes are unavailable while session data is unverified.'));
      return;
    }
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
  }, [normalizeTodo, readOnly, updateTodos, userId]);

  const commitTodos = useCallback((valueOrUpdater) => {
    if (readOnly) {
      return Promise.reject(new Error('Task changes are unavailable while session data is unverified.'));
    }
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
  }, [normalizeTodo, readOnly, updateTodos, userId]);

  const resolveConflict = useCallback((todoId, choice, newTodoId, workspaceId) => {
    if (readOnly) {
      return Promise.reject(new Error('Task conflict resolution is unavailable while session data is unverified.'));
    }
    const engine = engineRef.current;
    if (!engine || engine.userId !== userId) {
      return Promise.reject(new Error('Task sync is not ready to resolve conflicts.'));
    }
    return engine.resolveConflict(todoId, choice, newTodoId, workspaceId);
  }, [readOnly, userId]);

  const refresh = useCallback(async () => {
    if (readOnly) return;
    await engineRef.current?.refresh();
  }, [readOnly]);

  useEffect(() => {
    if (userId) return;
    writeStorageList(
      getUserScopedStorageKey(TODOS_STORAGE_KEY, userId),
      todos.map(normalizeTodo),
    );
  }, [normalizeTodo, todos, userId]);

  return [todos, setTodos, commitTodos, { conflicts, refresh, resolveConflict }];
};
