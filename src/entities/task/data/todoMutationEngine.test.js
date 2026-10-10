import test from 'node:test';
import assert from 'node:assert/strict';
import { TodoMutationEngine } from './todoMutationEngine.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

class MemoryJournal {
  records = new Map();
  failWrites = false;
  putCount = 0;
  failOnPutNumber = null;

  async put(record) {
    this.putCount += 1;
    if (this.failWrites || this.putCount === this.failOnPutNumber) {
      throw new Error('journal unavailable');
    }
    this.records.set(record.operationId, clone(record));
  }

  async list(userId) {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .sort((left, right) => left.sequence - right.sequence)
      .map(clone);
  }

  async delete(operationId) {
    this.records.delete(operationId);
  }

  async deleteMany(operationIds) {
    operationIds.forEach((operationId) => this.records.delete(operationId));
  }

  async replace(operationIds, replacement) {
    await this.put(replacement);
    await this.deleteMany(operationIds);
  }
}

class MemoryRepository {
  rows = new Map();
  idRegistry = new Set();
  outcomes = new Map();
  applyCalls = [];
  applyHandler = null;
  failTodoIds = new Set();

  async load() {
    return [...this.rows.values()]
      .filter((row) => !row.deleted)
      .map((row) => ({ todo: clone(row.todo), revision: row.revision }));
  }

  async readOne(_userId, todoId) {
    const row = this.rows.get(todoId);
    return row ? { ...clone(row), deleted: row.deleted } : null;
  }

  async getOutcome(_userId, operationId) {
    return clone(this.outcomes.get(operationId) || { status: 'not_found' });
  }

  async apply(mutation) {
    this.applyCalls.push(clone({
      operationId: mutation.operationId,
      todoId: mutation.todoId,
      kind: mutation.kind,
      expectedRevision: mutation.expectedRevision,
    }));
    if (this.failTodoIds.has(mutation.todoId)) throw new Error('network interrupted');
    if (this.applyHandler) return this.applyHandler(mutation, this);
    if (this.outcomes.has(mutation.operationId)) return clone(this.outcomes.get(mutation.operationId));

    const row = this.rows.get(mutation.todoId);
    let result;
    if (mutation.kind === 'create') {
      if (this.idRegistry.has(mutation.todoId)) {
        result = row?.deleted
          ? { status: 'deleted', todoId: mutation.todoId }
          : { status: 'conflict', todoId: mutation.todoId, currentTodo: clone(row.todo), currentRevision: row.revision };
      } else {
        this.idRegistry.add(mutation.todoId);
        const todo = clone(mutation.payload);
        result = { status: 'applied', todoId: mutation.todoId, todo, revision: 0, is_deleted: false };
        this.rows.set(mutation.todoId, { todo, revision: 0, deleted: false });
      }
    } else if (!row || row.deleted) {
      result = { status: 'deleted', todoId: mutation.todoId };
    } else if (row.revision !== mutation.expectedRevision) {
      result = {
        status: 'conflict',
        todoId: mutation.todoId,
        currentTodo: clone(row.todo),
        currentRevision: row.revision,
      };
    } else if (mutation.kind === 'update') {
      const todo = clone(mutation.payload);
      const revision = row.revision + 1;
      this.rows.set(mutation.todoId, { todo, revision, deleted: false });
      result = { status: 'applied', todoId: mutation.todoId, todo, revision, is_deleted: false };
    } else {
      const revision = row.revision + 1;
      this.rows.set(mutation.todoId, { ...row, revision, deleted: true });
      result = { status: 'applied', todoId: mutation.todoId, todo: clone(row.todo), revision, is_deleted: true };
    }
    this.outcomes.set(mutation.operationId, clone(result));
    return result;
  }
}

const normalizeTodo = (todo) => ({ ...todo });
const makeEngine = ({ repository = new MemoryRepository(), journal = new MemoryJournal(), onChange, isOnline } = {}) => ({
  repository,
  journal,
  engine: new TodoMutationEngine({
    userId: 'user-1',
    normalizeTodo,
    repository,
    journal,
    onChange,
    isOnline,
  }),
});

test('Create, Update, and Delete use per-task revisions and tombstones prevent ID reuse', async () => {
  const { engine, repository } = makeEngine();
  await engine.hydrate();
  await engine.mutate([{ id: 101, text: 'first' }]);
  await engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'second' })));
  await engine.mutate([]);

  assert.deepEqual(repository.applyCalls.map((call) => [call.kind, call.expectedRevision]), [
    ['create', null],
    ['update', 0],
    ['delete', 1],
  ]);
  assert.equal(repository.rows.get(101).deleted, true);
  await assert.rejects(
    engine.mutate([{ id: 101, text: 'stale recreate' }]),
    /cannot be reused/,
  );
  engine.dispose();
});

test('confirmed Task snapshots exclude pending creates and preserve confirmed values during edits', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(15, { todo: { id: 15, text: 'cloud' }, revision: 0, deleted: false });
  const createGate = deferred();
  const updateGate = deferred();
  const deleteGate = deferred();
  const apply = repository.apply.bind(repository);
  repository.apply = (mutation) => {
    const gate = mutation.todoId === 16
      ? createGate
      : mutation.todoId === 15 && mutation.kind === 'update'
        ? updateGate
        : mutation.todoId === 15 && mutation.kind === 'delete'
          ? deleteGate
          : null;
    return gate ? gate.promise.then(() => apply(mutation)) : apply(mutation);
  };
  const engine = makeEngine({ repository }).engine;
  await engine.hydrate();

  const original = engine.getConfirmedTodos();
  const create = engine.mutate((todos) => [...todos, { id: 16, text: 'pending create' }]);
  await tick();
  assert.deepEqual(engine.getConfirmedTodos(), original);
  createGate.resolve();
  await create;
  assert.equal(engine.getConfirmedTodos().some((todo) => todo.id === 16), true);

  const update = engine.mutate((todos) => todos.map((todo) => (
    todo.id === 15 ? { ...todo, text: 'pending update' } : todo
  )));
  await tick();
  assert.equal(engine.getConfirmedTodos().find((todo) => todo.id === 15).text, 'cloud');
  updateGate.resolve();
  await update;
  assert.equal(engine.getConfirmedTodos().find((todo) => todo.id === 15).text, 'pending update');

  const remove = engine.mutate((todos) => todos.filter((todo) => todo.id !== 15));
  await tick();
  assert.equal(engine.getConfirmedTodos().some((todo) => todo.id === 15), true);
  deleteGate.resolve();
  await remove;
  assert.equal(engine.getConfirmedTodos().some((todo) => todo.id === 15), false);
  engine.dispose();
});

test('mutations invoked during initial hydration run against the complete cloud state', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(151, { todo: { id: 151, text: 'existing' }, revision: 0, deleted: false });
  repository.idRegistry.add(151);
  const { engine } = makeEngine({ repository });
  const initialLoad = deferred();
  repository.load = () => initialLoad.promise;

  const mutation = engine.mutate((todos) => [...todos, { id: 152, text: 'new' }]);
  await tick();
  initialLoad.resolve([
    { todo: { id: 151, text: 'existing' }, revision: 0, deleted: false },
  ]);
  await mutation;

  assert.deepEqual(
    engine.getTodos().map((todo) => todo.id).sort((left, right) => left - right),
    [151, 152],
  );
  assert.equal(repository.rows.get(151).deleted, false);
  engine.dispose();
});

test('same-revision concurrent server writes admit only one winner', async () => {
  const { repository } = makeEngine();
  repository.rows.set(201, { todo: { id: 201, text: 'base' }, revision: 4, deleted: false });
  repository.idRegistry.add(201);

  const outcomes = await Promise.all([
    repository.apply({
      operationId: 'op-a', todoId: 201, kind: 'update', expectedRevision: 4,
      payload: { id: 201, text: 'device A' },
    }),
    repository.apply({
      operationId: 'op-b', todoId: 201, kind: 'update', expectedRevision: 4,
      payload: { id: 201, text: 'device B' },
    }),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), ['applied', 'conflict']);
  assert.equal(repository.rows.get(201).revision, 5);
  repository.rows.get(201).deleted = true;
  const stale = await repository.apply({
    operationId: 'op-c', todoId: 201, kind: 'update', expectedRevision: 5,
    payload: { id: 201, text: 'stale edit' },
  });
  assert.equal(stale.status, 'deleted');
});

test('late per-task RPC completions do not replace newer visible state', async () => {
  const gates = [];
  const { engine, repository } = makeEngine();
  await engine.hydrate();
  repository.applyHandler = (mutation, store) => {
    const gate = deferred();
    gates.push({ gate, mutation, store });
    return gate.promise;
  };

  const pendingCommit = engine.mutate([
    { id: 301, text: 'A1' },
    { id: 302, text: 'B1' },
  ]);
  await tick();
  const newerMutation = engine.mutate((todos) => todos.map((todo) => (
    todo.id === 301 ? { ...todo, text: 'A2' } : { ...todo, text: 'B2' }
  )));
  await tick();
  assert.deepEqual(engine.getTodos().map((todo) => todo.text), ['A2', 'B2']);

  const gateB = gates.find(({ mutation }) => mutation.todoId === 302);
  gateB.store.outcomes.set(gateB.mutation.operationId, {
    status: 'applied', todo: gateB.mutation.payload, revision: 0, is_deleted: false,
  });
  gateB.store.rows.set(302, { todo: gateB.mutation.payload, revision: 0, deleted: false });
  gateB.gate.resolve(gateB.store.outcomes.get(gateB.mutation.operationId));
  await tick();
  const gateA = gates.find(({ mutation }) => mutation.todoId === 301);
  gateA.store.outcomes.set(gateA.mutation.operationId, {
    status: 'applied', todo: gateA.mutation.payload, revision: 0, is_deleted: false,
  });
  gateA.store.rows.set(301, { todo: gateA.mutation.payload, revision: 0, deleted: false });
  gateA.gate.resolve(gateA.store.outcomes.get(gateA.mutation.operationId));
  await tick();

  await tick();
  const followups = gates.filter(({ mutation }) => mutation.payload?.text?.endsWith('2'));
  followups.forEach(({ gate, mutation, store }) => {
    const result = {
      status: 'applied', todo: mutation.payload, revision: 1, is_deleted: false,
    };
    store.rows.set(mutation.todoId, { todo: mutation.payload, revision: 1, deleted: false });
    store.outcomes.set(mutation.operationId, result);
    gate.resolve(result);
  });
  await Promise.all([pendingCommit, newerMutation]);
  assert.deepEqual(engine.getTodos().map((todo) => todo.text), ['A2', 'B2']);
  engine.dispose();
});

test('focus refresh discards snapshots made stale by a completed local mutation', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(351, { todo: { id: 351, text: 'before' }, revision: 0, deleted: false });
  repository.idRegistry.add(351);
  const { engine } = makeEngine({ repository });
  await engine.hydrate();

  const load = repository.load.bind(repository);
  const staleLoad = deferred();
  let loadCount = 0;
  repository.load = async (...args) => {
    loadCount += 1;
    return loadCount === 1 ? staleLoad.promise : load(...args);
  };
  const refresh = engine.refresh();
  await tick();
  await engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'after' })));
  staleLoad.resolve([{ todo: { id: 351, text: 'before' }, revision: 0, deleted: false }]);
  await refresh;
  for (let attempt = 0; attempt < 20 && loadCount < 2; attempt += 1) await tick();

  assert.ok(loadCount >= 2, 'a fresh snapshot should follow the discarded stale response');
  assert.equal(engine.getTodos()[0].text, 'after');
  engine.dispose();
});

test('uncertain committed operation is discovered after reload without duplicate mutation', async () => {
  const journal = new MemoryJournal();
  const repository = new MemoryRepository();
  const first = makeEngine({ journal, repository }).engine;
  await first.hydrate();
  repository.applyHandler = async (mutation, store) => {
    store.idRegistry.add(mutation.todoId);
    const result = {
      status: 'applied',
      todoId: mutation.todoId,
      todo: clone(mutation.payload),
      revision: 0,
      is_deleted: false,
    };
    store.rows.set(mutation.todoId, { todo: clone(mutation.payload), revision: 0, deleted: false });
    store.outcomes.set(mutation.operationId, clone(result));
    store.applyHandler = null;
    throw new Error('acknowledgment lost');
  };
  await assert.rejects(first.mutate([{ id: 401, text: 'durable' }]), /acknowledgment lost/);
  await tick();
  assert.equal(journal.records.size, 1);
  first.dispose();

  repository.applyHandler = null;
  const second = makeEngine({ journal, repository }).engine;
  const restored = await second.hydrate();
  assert.deepEqual(restored.map((todo) => todo.text), ['durable']);
  assert.equal(repository.applyCalls.length, 1, JSON.stringify({
    calls: repository.applyCalls,
    operationIds: [...repository.outcomes.keys()],
  }));
  assert.equal(journal.records.size, 0);
  second.dispose();
});

test('reconnection retries an uncommitted operation only after outcome verification', async () => {
  const repository = new MemoryRepository();
  const journal = new MemoryJournal();
  const { engine } = makeEngine({ repository, journal });
  await engine.hydrate();
  repository.applyHandler = async (_mutation, store) => {
    store.applyHandler = null;
    throw new Error('connection lost before commit');
  };
  await assert.rejects(engine.mutate([{ id: 451, text: 'retry safely' }]), /connection lost/);
  const operationId = [...journal.records.keys()][0];
  engine.retry();
  for (let attempt = 0; attempt < 20 && !repository.rows.has(451); attempt += 1) {
    await tick();
  }

  assert.ok(repository.rows.has(451));
  assert.equal(repository.applyCalls.length, 2);
  assert.equal(repository.applyCalls[0].operationId, operationId);
  assert.equal(repository.applyCalls[1].operationId, operationId);
  assert.equal(journal.records.size, 0);
  engine.dispose();
});

test('journal failure blocks RPC writes and rejects confirmed commits', async () => {
  const journal = new MemoryJournal();
  journal.failWrites = true;
  const { engine, repository } = makeEngine({ journal });
  await engine.hydrate();
  await assert.rejects(engine.mutate([{ id: 501, text: 'not safe to queue' }]), /journal unavailable/);
  assert.equal(repository.applyCalls.length, 0);
  assert.deepEqual(engine.getTodos().map((todo) => todo.text), ['not safe to queue']);
  await assert.rejects(
    engine.mutate((todos) => [...todos, { id: 502, text: 'must remain blocked' }]),
    /journal is unavailable/,
  );
  engine.dispose();
});

test('revision journaling failures reject promptly and retry the durable intent', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(551, { todo: { id: 551, text: 'before' }, revision: 4, deleted: false });
  repository.idRegistry.add(551);
  const journal = new MemoryJournal();
  journal.failOnPutNumber = 2;
  const { engine } = makeEngine({ repository, journal });
  await engine.hydrate();

  await assert.rejects(
    engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'after' }))),
    /journal unavailable/,
  );
  assert.equal(repository.applyCalls.length, 0);
  assert.equal(engine.getTodos()[0].text, 'after');

  journal.failOnPutNumber = null;
  engine.retry();
  for (let attempt = 0; attempt < 20 && repository.rows.get(551).revision === 4; attempt += 1) {
    await tick();
  }
  assert.equal(repository.rows.get(551).todo.text, 'after');
  assert.equal(repository.rows.get(551).revision, 5);
  engine.dispose();
});

test('protocol upgrade rejection settles every task commit and keeps journal records', async () => {
  const repository = new MemoryRepository();
  const journal = new MemoryJournal();
  const { engine } = makeEngine({ repository, journal });
  await engine.hydrate();
  repository.applyHandler = async () => ({ status: 'protocol_upgrade_required' });

  await assert.rejects(
    engine.mutate([{ id: 571, text: 'first' }, { id: 572, text: 'second' }]),
    /can no longer save tasks/,
  );
  assert.equal(journal.records.size, 2);
  assert.equal(engine.protocolBlocked, true);
  engine.dispose();
});

test('disposing a waiting engine rejects callers without clearing the journal', async () => {
  const repository = new MemoryRepository();
  const journal = new MemoryJournal();
  const { engine } = makeEngine({ repository, journal });
  await engine.hydrate();
  repository.applyHandler = async () => ({ status: 'cutover_pending' });

  const commit = engine.mutate([{ id: 581, text: 'waiting' }]);
  for (let attempt = 0; attempt < 20 && journal.records.size === 0; attempt += 1) await tick();
  engine.dispose();

  await assert.rejects(commit, /pending changes remain in the journal/);
  assert.equal(journal.records.size, 1);
});

test('offline state rejects new mutations without sending or journaling them', async () => {
  let online = false;
  const { engine, repository, journal } = makeEngine({ isOnline: () => online });
  await assert.rejects(engine.hydrate(), /offline/);
  await assert.rejects(engine.mutate([{ id: 601, text: 'offline' }]), /disabled/);
  assert.equal(repository.applyCalls.length, 0);
  assert.equal(journal.records.size, 0);
  engine.dispose();
});

test('multi-task partial success settles successful rows and retains conflicted drafts', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(701, { todo: { id: 701, text: 'A' }, revision: 0, deleted: false });
  repository.rows.set(702, { todo: { id: 702, text: 'B' }, revision: 1, deleted: false });
  repository.rows.set(703, { todo: { id: 703, text: 'C' }, revision: 0, deleted: false });
  repository.idRegistry.add(701);
  repository.idRegistry.add(702);
  repository.idRegistry.add(703);
  const { engine, journal } = makeEngine({ repository });
  await engine.hydrate();
  repository.rows.get(702).revision = 2;
  repository.failTodoIds.add(703);

  await assert.rejects(engine.mutate((todos) => todos.map((todo) => (
    { ...todo, text: `${todo.text}-local` }
  ))), /changed on another device/);

  assert.equal(repository.rows.get(701).todo.text, 'A-local');
  assert.equal(repository.rows.get(702).todo.text, 'B');
  assert.equal(repository.rows.get(703).todo.text, 'C');
  assert.equal(journal.records.size, 2);
  assert.deepEqual(engine.getTodos().map((todo) => todo.text), ['A-local', 'B-local', 'C-local']);
  assert.deepEqual(engine.getConflicts().map((conflict) => conflict.todoId), [702]);
  engine.dispose();
});

test('explicitly choosing the local version retries against the latest revision', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(801, { todo: { id: 801, text: 'base' }, revision: 0, deleted: false });
  repository.idRegistry.add(801);
  const { engine } = makeEngine({ repository });
  await engine.hydrate();
  repository.rows.set(801, { todo: { id: 801, text: 'remote' }, revision: 1, deleted: false });

  await assert.rejects(
    engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'local' }))),
    /changed on another device/,
  );
  await engine.resolveConflict(801, 'local');

  assert.equal(repository.rows.get(801).todo.text, 'local');
  assert.equal(repository.rows.get(801).revision, 2);
  assert.deepEqual(engine.getConflicts(), []);
  engine.dispose();
});

test('choosing the server version discards the local journal and restores server state', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(851, { todo: { id: 851, text: 'base' }, revision: 0, deleted: false });
  repository.idRegistry.add(851);
  const { engine, journal } = makeEngine({ repository });
  await engine.hydrate();
  repository.rows.set(851, { todo: { id: 851, text: 'remote' }, revision: 1, deleted: false });

  await assert.rejects(
    engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'local' }))),
    /changed on another device/,
  );
  await engine.resolveConflict(851, 'server');

  assert.equal(engine.getTodos()[0].text, 'remote');
  assert.equal(journal.records.size, 0);
  assert.deepEqual(engine.getConflicts(), []);
  engine.dispose();
});

test('Delete Wins can be explicitly confirmed against the latest active revision', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(901, { todo: { id: 901, text: 'base' }, revision: 0, deleted: false });
  repository.idRegistry.add(901);
  const { engine } = makeEngine({ repository });
  await engine.hydrate();
  repository.rows.set(901, { todo: { id: 901, text: 'edited remotely' }, revision: 1, deleted: false });

  await assert.rejects(engine.mutate([]), /changed on another device/);
  assert.equal(engine.getConflicts()[0].deleteRequested, true);
  await engine.resolveConflict(901, 'delete');

  assert.equal(repository.rows.get(901).deleted, true);
  assert.equal(repository.rows.get(901).revision, 2);
  assert.deepEqual(engine.getTodos(), []);
  engine.dispose();
});

test('deleted Task drafts can only be saved as a new ID', async () => {
  const repository = new MemoryRepository();
  repository.rows.set(1001, { todo: { id: 1001, text: 'base' }, revision: 0, deleted: false });
  repository.idRegistry.add(1001);
  const { engine } = makeEngine({ repository });
  await engine.hydrate();
  repository.rows.set(1001, { todo: { id: 1001, text: 'base' }, revision: 1, deleted: true });

  await assert.rejects(
    engine.mutate((todos) => todos.map((todo) => ({ ...todo, text: 'unsaved draft' }))),
    /deleted on another device/,
  );
  await assert.rejects(engine.resolveConflict(1001, 'local'), /save the draft as a new Task/);
  await engine.resolveConflict(1001, 'save_as_new', 2001);

  assert.equal(repository.rows.get(1001).deleted, true);
  assert.equal(repository.rows.get(2001).todo.text, 'unsaved draft');
  assert.deepEqual(engine.getTodos().map((todo) => todo.id), [2001]);
  engine.dispose();
});

test('invalid Workspace drafts can only be retried in an explicitly selected Workspace', async () => {
  const { engine, repository } = makeEngine();
  await engine.hydrate();
  repository.applyHandler = (mutation, repo) => {
    if (mutation.kind === 'create' && mutation.payload.desktopWorkspaceId === 'deleted-workspace') {
      repo.applyHandler = null;
      return { status: 'workspace_invalid', todoId: mutation.todoId };
    }
    throw new Error('Unexpected mutation in workspace validation test.');
  };

  await assert.rejects(
    engine.mutate([{ id: 601, text: 'draft', desktopWorkspaceId: 'deleted-workspace' }]),
    /Workspace is no longer available/,
  );
  assert.equal((await engine.journal.list('user-1')).length, 1);
  assert.equal(engine.getConflicts()[0].workspaceInvalid, true);
  await engine.resolveConflict(601, 'save_as_new', 602, 'active-workspace');

  assert.equal((await engine.journal.list('user-1')).length, 0);
  assert.equal(repository.rows.get(602).todo.desktopWorkspaceId, 'active-workspace');
  assert.equal(engine.getTodos()[0].id, 602);
  engine.dispose();
});
