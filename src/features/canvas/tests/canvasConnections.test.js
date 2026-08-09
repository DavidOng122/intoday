import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConnectionOperations,
  createConnectionOperationsForReplacement,
  createDesktopConnection,
  dedupeDesktopConnections,
  findConnectionTargetAtPoint,
  getDesktopConnectionId,
  getGroupHandleCoordinates,
  migrateLegacyConnections,
  removeConnectionsForGroupIds,
  rewireConnectionsForPackMerge,
} from '../model/canvasConnections.js';

const makeConnection = (sourceGroupId, targetGroupId, overrides = {}) => createDesktopConnection({
  workspaceId: 'workspace-a',
  sourceGroupId,
  targetGroupId,
  now: 1000,
  ...overrides,
});

test('connections canonicalize endpoint order and swap sides', () => {
  const connection = makeConnection('group-z', 'group-a', { sourceSide: 'right', targetSide: 'left' });
  assert.equal(connection.sourceGroupId, 'group-a');
  assert.equal(connection.sourceSide, 'left');
  assert.equal(connection.targetGroupId, 'group-z');
  assert.equal(connection.targetSide, 'right');
  assert.equal(connection.id, getDesktopConnectionId('workspace-a', 'group-a', 'group-z'));
});

test('connections reject self-links and deduplicate reverse links', () => {
  assert.equal(makeConnection('group-a', 'group-a'), null);
  const first = makeConnection('group-a', 'group-b');
  const reverse = makeConnection('group-b', 'group-a');
  assert.equal(dedupeDesktopConnections([first, reverse]).length, 1);
});

test('getGroupHandleCoordinates calculates left and right handle points', () => {
  const entry = { type: 'group', id: 'group-1', x: 100, y: 200, tasks: [{ id: '1' }, { id: '2' }] };
  assert.equal(getGroupHandleCoordinates(entry, 'left').x, 100);
  assert.equal(getGroupHandleCoordinates(entry, 'right').x, 436);
});

test('findConnectionTargetAtPoint uses canvas geometry without DOM scanning', () => {
  const entries = [{ type: 'group', id: 'group-1', x: 100, y: 200, tasks: [{ id: '1' }, { id: '2' }] }];
  assert.deepEqual(findConnectionTargetAtPoint(entries, { x: 102, y: 240 }), {
    targetGroupId: 'group-1', targetSide: 'left', distance: 2,
  });
  assert.equal(findConnectionTargetAtPoint(entries, { x: 200, y: 240 }), null);
});

test('legacy migration keeps only valid same-workspace Pack links', () => {
  const migrated = migrateLegacyConnections({
    legacyConnections: [
      { sourceGroupId: 'a', targetGroupId: 'b' },
      { sourceGroupId: 'a', targetGroupId: 'c' },
      { sourceGroupId: 'a', targetGroupId: 'missing' },
      { sourceGroupId: 'a', targetGroupId: 'a' },
    ],
    tasks: [
      { desktopGroupId: 'a', desktopWorkspaceId: 'workspace-1' },
      { desktopGroupId: 'b', desktopWorkspaceId: 'workspace-1' },
      { desktopGroupId: 'c', desktopWorkspaceId: 'workspace-2' },
    ],
    defaultWorkspaceId: 'default',
  });
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].workspaceId, 'workspace-1');
});

test('Pack merge rewires source links, removes self-links, and deduplicates', () => {
  const connections = [
    makeConnection('source', 'target'),
    makeConnection('source', 'third'),
    makeConnection('target', 'third'),
  ];
  const next = rewireConnectionsForPackMerge(connections, {
    workspaceId: 'workspace-a', sourceGroupId: 'source', targetGroupId: 'target', now: 2000,
  });
  assert.equal(next.length, 1);
  assert.deepEqual([next[0].sourceGroupId, next[0].targetGroupId], ['target', 'third']);
});

test('Pack deletion removes only links touching deleted groups', () => {
  const connections = [makeConnection('a', 'b'), makeConnection('b', 'c')];
  const next = removeConnectionsForGroupIds(connections, 'workspace-a', ['a']);
  assert.equal(next.length, 1);
  assert.deepEqual([next[0].sourceGroupId, next[0].targetGroupId], ['b', 'c']);
});

test('replacement operations soft-delete missing ids and upsert changed rows', () => {
  const first = makeConnection('a', 'b');
  const second = makeConnection('b', 'c');
  const changed = makeConnection('b', 'c', { now: 2000 });
  const operations = createConnectionOperationsForReplacement([first, second], [changed], 'workspace-a');
  assert.deepEqual(operations.map((operation) => operation.type).sort(), ['delete', 'upsert']);
  const applied = applyConnectionOperations([first, second], operations, 'workspace-a');
  assert.deepEqual(applied, [changed]);
});
