const createOperationId = () => (
  globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  })
);

const taskIdOf = (task) => {
  const id = Number(task?.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Task ID "${task?.id}" is not a safe integer.`);
  }
  return id;
};

const sameTask = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject, settled: false };
};

const mutationError = (status, mutation, result = {}) => {
  const error = new Error(
    status === 'deleted'
      ? `Task ${mutation.todoId} was deleted on another device.`
      : status === 'conflict'
        ? `Task ${mutation.todoId} changed on another device.`
        : status === 'protocol_upgrade_required'
          ? 'This app version can no longer save tasks. Reload after preserving pending changes.'
            : status === 'workspace_invalid'
              ? `Task ${mutation.todoId} could not be saved because its Workspace is no longer available.`
              : `Task ${mutation.todoId} could not be synchronized.`,
  );
  error.name = status === 'conflict' || status === 'deleted'
    ? 'TodoSyncConflictError'
    : status === 'protocol_upgrade_required'
      ? 'TodoSyncProtocolError'
      : 'TodoSyncError';
  error.status = status;
  error.todoId = mutation.todoId;
  error.localTodo = mutation.kind === 'delete' ? null : mutation.payload;
  error.currentTodo = result.currentTodo || null;
  error.currentRevision = result.currentRevision ?? null;
  return error;
};

export class TodoMutationEngine {
  constructor({ userId, normalizeTodo, repository, journal, onChange, onError, isOnline }) {
    this.userId = userId;
    this.normalizeTodo = normalizeTodo;
    this.repository = repository;
    this.journal = journal;
    this.onChange = onChange;
    this.onError = onError;
    this.isOnline = isOnline || (() => globalThis.navigator?.onLine !== false);
    this.entries = new Map();
    this.order = [];
    this.sequence = 0;
    this.pumping = new Set();
    this.networkUncertain = false;
    this.journalBlocked = false;
    this.reconciliationPending = false;
    this.protocolBlocked = false;
    this.hydrated = false;
    this.hydrating = null;
    this.disposed = false;
    this.retryTimer = null;
    this.stateVersion = 0;
    this.refreshing = null;
    this.refreshRequested = false;
  }

  getTodos() {
    const todos = [];
    this.order.forEach((id) => {
      const entry = this.entries.get(id);
      if (!entry) return;
      const latest = entry.pending.at(-1);
      const todo = latest ? latest.kind === 'delete' ? null : latest.payload : entry.confirmed;
      if (todo) todos.push(todo);
    });
    return todos;
  }

  getConflicts() {
    return [...this.entries.values()]
      .filter((entry) => entry.blocked)
      .map((entry) => ({
        todoId: entry.todoId,
        localTodo: entry.pending.at(-1)?.kind === 'delete' ? null : entry.pending.at(-1)?.payload,
        currentTodo: entry.blocked.currentTodo || null,
        currentRevision: entry.blocked.currentRevision ?? null,
        deleted: entry.blocked.status === 'deleted',
        workspaceInvalid: entry.blocked.status === 'workspace_invalid',
        deleteRequested: entry.pending.at(-1)?.kind === 'delete',
      }));
  }

  publish() {
    if (this.disposed) return;
    this.onChange?.(this.getTodos(), this.getConflicts());
  }

  async hydrate() {
    if (this.hydrated) return this.getTodos();
    if (this.hydrating) return this.hydrating;
    this.hydrating = this.hydrateFromServer();
    try {
      return await this.hydrating;
    } finally {
      this.hydrating = null;
    }
  }

  async hydrateFromServer() {
    if (!this.isOnline()) throw new Error('Task sync is offline; cached task data is read-only.');
    const cloudRecords = await this.repository.load(this.userId);
    cloudRecords.forEach(({ todo, revision, deleted }) => {
      const todoId = taskIdOf(todo);
      let entry = this.entries.get(todoId);
      if (!entry) {
        entry = this.createEntry(todoId);
        this.entries.set(todoId, entry);
      }
      if (entry.pending.length === 0) {
        entry.confirmed = deleted ? null : this.normalizeTodo(todo);
        entry.revision = revision;
        entry.tombstoneIntent = deleted;
      }
    });
    const activeIds = cloudRecords
      .filter(({ deleted }) => !deleted)
      .map(({ todo }) => taskIdOf(todo));
    const pendingIds = this.order.filter((id) => this.entries.get(id)?.pending.length);
    this.order = [...activeIds, ...pendingIds.filter((id) => !activeIds.includes(id))];

    const mutations = await this.journal.list(this.userId);
    mutations.forEach((mutation) => {
      const entry = this.getOrCreateEntry(mutation.todoId);
      if (entry.pending.some((pending) => pending.operationId === mutation.operationId)) return;
      const deferred = createDeferred();
      deferred.promise.catch(() => {});
      entry.pending.push({ ...mutation, deferred, recovered: true });
      this.sequence = Math.max(this.sequence, mutation.sequence || 0);
      if (mutation.kind !== 'delete' && !this.order.includes(mutation.todoId)) {
        this.order.push(mutation.todoId);
      }
      if (mutation.kind === 'delete') this.order = this.order.filter((id) => id !== mutation.todoId);
    });

    for (const entry of this.entries.values()) {
      while (entry.pending[0]?.recovered && entry.pending[0]?.attempted) {
        const mutation = entry.pending[0];
        const outcome = await this.repository.getOutcome(this.userId, mutation.operationId);
        if (outcome.status === 'applied') {
          await this.confirm(entry, mutation, outcome);
          continue;
        }
        if (outcome.status === 'protocol_upgrade_required') {
          this.stopForProtocol(mutation, outcome);
          break;
        }
        if (outcome.status !== 'not_found') {
          this.blockEntry(entry, mutation, outcome);
        }
        break;
      }
    }
    this.refreshReconciliationState();
    this.hydrated = true;
    this.publish();
    this.entries.forEach((_, todoId) => void this.pump(todoId));
    return this.getTodos();
  }

  createEntry(todoId) {
    return {
      todoId,
      confirmed: null,
      revision: null,
      pending: [],
      blocked: null,
      tombstoneIntent: false,
    };
  }

  getOrCreateEntry(todoId) {
    let entry = this.entries.get(todoId);
    if (!entry) {
      entry = this.createEntry(todoId);
      this.entries.set(todoId, entry);
    }
    return entry;
  }

  mutate(updater) {
    if (this.disposed) return Promise.reject(new Error('Task sync is no longer active.'));
    if (this.protocolBlocked) {
      return Promise.reject(mutationError('protocol_upgrade_required', { todoId: null }));
    }
    if (!this.isOnline()) {
      return Promise.reject(new Error('Task changes are disabled while offline.'));
    }
    if (!this.hydrated) return this.hydrate().then(() => this.mutate(updater));
    if (this.journalBlocked) {
      return Promise.reject(new Error('Task changes are blocked because the pending journal is unavailable.'));
    }
    if (!this.isOnline() || this.networkUncertain || this.reconciliationPending) {
      return Promise.reject(new Error('Task changes are disabled until the connection is verified.'));
    }

    const previousTodos = this.getTodos();
    let value;
    try {
      value = typeof updater === 'function' ? updater(previousTodos) : updater;
    } catch (error) {
      return Promise.reject(error);
    }
    if (!Array.isArray(value)) return Promise.reject(new TypeError('Task updates must produce an array.'));
    let nextTodos;
    try {
      nextTodos = value.map(this.normalizeTodo);
      const ids = nextTodos.map(taskIdOf);
      if (new Set(ids).size !== ids.length) throw new Error('Task updates cannot contain duplicate IDs.');
    } catch (error) {
      return Promise.reject(error);
    }

    const previousById = new Map(previousTodos.map((todo) => [taskIdOf(todo), todo]));
    const nextById = new Map(nextTodos.map((todo) => [taskIdOf(todo), todo]));
    const changes = [];

    nextById.forEach((todo, todoId) => {
      const previous = previousById.get(todoId);
      if (previous && sameTask(previous, todo)) return;
      const entry = this.entries.get(todoId);
      if (entry?.blocked) {
        changes.push({ error: mutationError(entry.blocked.status, entry.pending[0], entry.blocked) });
        return;
      }
      if (entry?.tombstoneIntent) {
        changes.push({ error: new Error(`Deleted Task ID ${todoId} cannot be reused.`) });
        return;
      }
      const isPendingCreate = entry?.pending.some((mutation) => mutation.kind === 'create');
      const kind = !previous && !isPendingCreate && !entry?.confirmed ? 'create' : 'update';
      changes.push({ todoId, kind, payload: todo, entry });
    });

    previousById.forEach((_, todoId) => {
      if (nextById.has(todoId)) return;
      const entry = this.entries.get(todoId);
      if (!entry || entry.blocked) {
        changes.push({
          error: entry?.blocked
            ? mutationError(entry.blocked.status, entry.pending[0], entry.blocked)
            : new Error(`Task ${todoId} is not in the synchronized state.`),
        });
        return;
      }
      changes.push({ todoId, kind: 'delete', payload: null, entry });
    });

    const failedChange = changes.find((change) => change.error);
    if (failedChange) return Promise.reject(failedChange.error);

    this.order = nextTodos.map(taskIdOf);
    this.stateVersion += 1;
    const submitted = changes.map((change) => {
      const entry = change.entry || this.getOrCreateEntry(change.todoId);
      if (change.kind === 'delete') entry.tombstoneIntent = true;
      const deferred = createDeferred();
      const mutation = {
        userId: this.userId,
        operationId: createOperationId(),
        sequence: ++this.sequence,
        todoId: change.todoId,
        kind: change.kind,
        payload: change.payload,
        expectedRevision: null,
        attempted: false,
        createdAt: new Date().toISOString(),
        deferred,
        recovered: false,
      };
      entry.pending.push(mutation);
      return { todoId: change.todoId, deferred };
    });

    this.publish();
    new Set(submitted.map(({ todoId }) => todoId)).forEach((todoId) => void this.pump(todoId));
    return Promise.all(submitted.map(({ deferred }) => deferred.promise))
      .then(() => this.getTodos());
  }

  async pump(todoId) {
    const entry = this.entries.get(todoId);
    if (!entry || entry.blocked || this.pumping.has(todoId) || this.disposed) return;
    this.pumping.add(todoId);
    try {
      while (entry.pending.length && !entry.blocked && !this.protocolBlocked && !this.disposed) {
        if (!this.isOnline() || this.networkUncertain) return;
        const mutation = entry.pending[0];
        try {
          await this.journal.put(this.serializeMutation(mutation));
          this.journalBlocked = false;
        } catch (error) {
          this.journalBlocked = true;
          this.report(error, mutation);
          this.rejectPending(entry, error);
          this.scheduleRetry();
          return;
        }

        if (mutation.kind !== 'create' && mutation.expectedRevision === null) {
          if (entry.revision === null) {
            this.blockEntry(entry, mutation, { status: 'conflict' });
            return;
          }
          mutation.expectedRevision = entry.revision;
          try {
            await this.journal.put(this.serializeMutation(mutation));
          } catch (error) {
            this.journalBlocked = true;
            this.report(error, mutation);
            this.rejectPending(entry, error);
            this.scheduleRetry();
            return;
          }
        }

        try {
          if (mutation.attempted || mutation.recovered) {
            const recovered = await this.reconcileAttempt(entry, mutation);
            if (recovered === 'settled') continue;
            if (recovered === 'blocked') return;
          }

          mutation.attempted = true;
          await this.journal.put(this.serializeMutation(mutation));
          const result = await this.repository.apply(mutation);
          if (result.status === 'applied') {
            await this.confirm(entry, mutation, result);
            continue;
          }
          if (result.status === 'protocol_upgrade_required') {
            this.stopForProtocol(mutation, result);
            return;
          }
          if (result.status === 'cutover_pending') {
            if (!mutation.cutoverNotified) {
              mutation.cutoverNotified = true;
              this.report(new Error('Task sync is waiting for the controlled server cutover.'), mutation);
            }
            this.scheduleRetry();
            return;
          }
          this.blockEntry(entry, mutation, result);
          return;
        } catch (error) {
          this.networkUncertain = true;
          this.report(error, mutation);
          this.rejectPending(entry, error);
          this.scheduleRetry();
          return;
        }
      }
    } finally {
      this.pumping.delete(todoId);
    }
  }

  async reconcileAttempt(entry, mutation) {
    const outcome = await this.repository.getOutcome(this.userId, mutation.operationId);
    if (outcome.status === 'applied') {
      await this.confirm(entry, mutation, outcome);
      return 'settled';
    }
    if (outcome.status !== 'not_found') {
      if (outcome.status === 'protocol_upgrade_required') {
        this.stopForProtocol(mutation, outcome);
        return 'blocked';
      }
      this.blockEntry(entry, mutation, outcome);
      return 'blocked';
    }
    const current = await this.repository.readOne(this.userId, mutation.todoId);
    const safe = mutation.kind === 'create'
      ? current === null
      : current !== null
        && !current.deleted
        && current.revision === mutation.expectedRevision;
    if (!safe) {
      this.blockEntry(entry, mutation, {
        status: current?.deleted || !current ? 'deleted' : 'conflict',
        currentTodo: current?.todo || null,
        currentRevision: current?.revision ?? null,
      });
      return 'blocked';
    }
    return 'retry';
  }

  async confirm(entry, mutation, result) {
    if (result.revision !== null && !Number.isSafeInteger(result.revision)) {
      throw new Error(`Server returned an invalid revision for Task ${mutation.todoId}.`);
    }
    entry.confirmed = result.is_deleted ? null : this.normalizeTodo(result.todo);
    entry.revision = result.revision;
    if (mutation.kind === 'delete') {
      entry.tombstoneIntent = true;
      this.order = this.order.filter((id) => id !== mutation.todoId);
    }
    entry.pending.shift();
    entry.blocked = null;
    this.stateVersion += 1;
    this.refreshReconciliationState();
    try {
      await this.journal.delete(mutation.operationId);
    } catch (error) {
      this.report(error, mutation);
    }
    mutation.deferred.settled = true;
    mutation.deferred.resolve();
    this.publish();
  }

  blockEntry(entry, mutation, result) {
    const error = mutationError(result.status, mutation, result);
    entry.blocked = {
      status: result.status,
      currentTodo: result.currentTodo ? this.normalizeTodo(result.currentTodo) : null,
      currentRevision: result.currentRevision ?? null,
    };
    this.stateVersion += 1;
    entry.pending.forEach((pending) => {
      if (!pending.deferred.settled) {
        pending.deferred.settled = true;
        pending.deferred.reject(error);
      }
    });
    this.report(error, mutation);
    this.refreshReconciliationState();
    this.publish();
  }

  stopForProtocol(mutation, result) {
    this.protocolBlocked = true;
    this.stateVersion += 1;
    const error = mutationError('protocol_upgrade_required', { todoId: null }, result);
    this.entries.forEach((pendingEntry) => this.rejectPending(pendingEntry, error));
    this.report(error, mutation);
    this.publish();
  }

  async resolveConflict(todoId, choice, newTodoId = null, workspaceId = null) {
    const entry = this.entries.get(Number(todoId));
    if (!entry?.blocked || !entry.pending.length) {
      throw new Error(`Task ${todoId} has no pending conflict to resolve.`);
    }
    const conflict = entry.blocked;
    if (conflict.status === 'protocol_upgrade_required') {
      throw new Error('Protocol upgrade conflicts cannot be resolved by selecting a Task version.');
    }

    const pending = [...entry.pending];
    const localTodo = pending.at(-1)?.kind === 'delete' ? null : pending.at(-1)?.payload || null;
    const currentTodo = conflict.currentTodo;
    const currentRevision = conflict.currentRevision;

    if (choice === 'server' || (choice === 'delete' && !currentTodo)) {
      await this.journal.deleteMany(pending.map((mutation) => mutation.operationId));
      entry.pending = [];
      entry.confirmed = currentTodo;
      entry.revision = currentRevision;
      entry.blocked = null;
      entry.tombstoneIntent = !currentTodo;
      this.stateVersion += 1;
      if (currentTodo && !this.order.includes(entry.todoId)) this.order.push(entry.todoId);
      if (!currentTodo) this.order = this.order.filter((id) => id !== entry.todoId);
      this.publish();
      return this.getTodos();
    }

    if (choice !== 'local' && choice !== 'delete' && choice !== 'save_as_new') {
      throw new Error(`Unsupported Task conflict resolution "${choice}".`);
    }
    if (!localTodo && choice !== 'delete') {
      throw new Error('There is no local Task draft to keep.');
    }
    if ((choice === 'local' || choice === 'delete') && (!currentTodo || currentRevision === null)) {
      throw new Error('The Task was deleted elsewhere; save the draft as a new Task instead.');
    }
    if (
      choice === 'save_as_new'
      && (!localTodo || !Number.isSafeInteger(Number(newTodoId)) || Number(newTodoId) <= 0)
    ) {
      throw new Error('Saving this draft as a new Task requires a fresh numeric Task ID.');
    }

    const targetTodoId = choice === 'save_as_new' ? Number(newTodoId) : entry.todoId;
    if (targetTodoId === entry.todoId && choice === 'save_as_new') {
      throw new Error('A deleted Task draft must use a new Task ID.');
    }
    if (this.entries.has(targetTodoId) && targetTodoId !== entry.todoId) {
      throw new Error(`Task ID ${targetTodoId} is already present in this device's state.`);
    }

    const targetTodo = choice === 'save_as_new'
      ? this.normalizeTodo({
        ...localTodo,
        id: targetTodoId,
        ...(workspaceId ? { desktopWorkspaceId: workspaceId } : {}),
      })
      : choice === 'delete'
        ? null
        : this.normalizeTodo(localTodo);
    const mutation = {
      userId: this.userId,
      operationId: createOperationId(),
      sequence: ++this.sequence,
      todoId: targetTodoId,
      kind: choice === 'save_as_new' ? 'create' : choice === 'delete' ? 'delete' : 'update',
      payload: targetTodo,
      expectedRevision: choice === 'save_as_new' ? null : currentRevision,
      attempted: false,
      createdAt: new Date().toISOString(),
      deferred: createDeferred(),
      recovered: false,
    };

    await this.journal.replace(
      pending.map((item) => item.operationId),
      this.serializeMutation(mutation),
    );

    entry.pending = [];
    entry.blocked = null;
    this.stateVersion += 1;
    if (choice === 'save_as_new') {
      entry.confirmed = null;
      entry.revision = null;
      entry.tombstoneIntent = true;
      this.order = this.order.filter((id) => id !== entry.todoId);
      const newEntry = this.getOrCreateEntry(targetTodoId);
      newEntry.pending.push(mutation);
      this.order.push(targetTodoId);
    } else {
      entry.confirmed = currentTodo;
      entry.revision = currentRevision;
      entry.tombstoneIntent = choice === 'delete';
      entry.pending.push(mutation);
      if (choice === 'delete') this.order = this.order.filter((id) => id !== entry.todoId);
    }

    this.publish();
    void this.pump(targetTodoId);
    return mutation.deferred.promise.then(() => this.getTodos());
  }

  rejectPending(entry, error) {
    entry.pending.forEach((mutation) => {
      if (!mutation.deferred.settled) {
        mutation.deferred.settled = true;
        mutation.deferred.reject(error);
      }
    });
  }

  refreshReconciliationState() {
    this.reconciliationPending = [...this.entries.values()].some((entry) => (
      !entry.blocked && entry.pending[0]?.recovered && entry.pending[0]?.attempted
    ));
  }

  serializeMutation(mutation) {
    const {
      deferred: _deferred,
      recovered: _recovered,
      ...record
    } = mutation;
    return record;
  }

  report(error, mutation) {
    this.onError?.(error, mutation ? {
      todoId: mutation.todoId,
      localTodo: mutation.kind === 'delete' ? null : mutation.payload,
    } : null);
  }

  scheduleRetry() {
    if (this.retryTimer || this.disposed) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.isOnline()) return;
      this.networkUncertain = false;
      this.entries.forEach((_, todoId) => void this.pump(todoId));
    }, 5000);
  }

  retry() {
    if (this.disposed || !this.isOnline()) return;
    if (!this.hydrated) {
      void this.hydrate().catch((error) => this.report(error));
      return;
    }
    this.networkUncertain = false;
    this.entries.forEach((_, todoId) => void this.pump(todoId));
    void this.refresh();
  }

  async refresh() {
    if (this.disposed || !this.isOnline() || this.networkUncertain) return;
    if (this.refreshing) {
      this.refreshRequested = true;
      return this.refreshing;
    }
    const refreshRequest = this.refreshSnapshot();
    this.refreshing = refreshRequest;
    try {
      await refreshRequest;
    } catch (error) {
      this.report(error);
    } finally {
      this.refreshing = null;
      if (this.refreshRequested && !this.disposed) {
        this.refreshRequested = false;
        void this.refresh();
      }
    }
  }

  async refreshSnapshot() {
    const stateVersion = this.stateVersion;
    const cloudRecords = await this.repository.load(this.userId);
    if (this.disposed) return;
    if (stateVersion !== this.stateVersion) {
      this.refreshRequested = true;
      return;
    }
    const activeIds = [];
    cloudRecords.forEach(({ todo, revision, deleted }) => {
      const todoId = taskIdOf(todo);
      let entry = this.entries.get(todoId);
      if (!entry) {
        entry = this.createEntry(todoId);
        this.entries.set(todoId, entry);
      }
      if (entry.pending.length || this.pumping.has(todoId)) return;
      entry.confirmed = deleted ? null : this.normalizeTodo(todo);
      entry.revision = revision;
      entry.tombstoneIntent = deleted;
      if (!deleted) activeIds.push(todoId);
    });
    const pendingIds = this.order.filter((id) => {
      const entry = this.entries.get(id);
      return entry?.pending.length || this.pumping.has(id);
    });
    this.order = [...activeIds, ...pendingIds.filter((id) => !activeIds.includes(id))];
    this.publish();
  }

  dispose() {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const error = new Error('Task sync stopped; pending changes remain in the journal.');
    this.entries.forEach((entry) => this.rejectPending(entry, error));
  }
}
