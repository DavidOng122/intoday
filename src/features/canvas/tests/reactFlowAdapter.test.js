import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPackGroupIdFromReactFlowNodeId,
  getReactFlowPackNodeId,
  getReactFlowTaskNodeId,
  getSelectedTaskIdsFromReactFlowNodes,
  toReactFlowEdge,
  toReactFlowNode,
  toReactFlowEdges,
} from '../adapters/reactFlowAdapter.js';

test('React Flow node ids keep Task and Pack namespaces separate', () => {
  assert.equal(getReactFlowTaskNodeId('same:id'), 'task:same%3Aid');
  assert.equal(getReactFlowPackNodeId('same:id'), 'pack:same%3Aid');
  assert.equal(getPackGroupIdFromReactFlowNodeId('pack:same%3Aid'), 'same:id');
  assert.equal(getPackGroupIdFromReactFlowNodeId('task:same%3Aid'), null);
  assert.equal(getPackGroupIdFromReactFlowNodeId('pack:%E0%A4%A'), null);
});

test('React Flow nodes use domain positions and enable Flow drag and selection', () => {
  const entry = { type: 'task', task: { id: 1 }, x: 12, y: 24 };
  const node = toReactFlowNode(entry, {
    measured: { width: 336, height: 284 },
    zIndex: 3,
  });

  assert.equal(node.id, 'task:1');
  assert.deepEqual(node.position, { x: 12, y: 24 });
  assert.equal(node.draggable, true);
  assert.equal(node.selectable, true);
  assert.equal(Object.hasOwn(node, 'selected'), false);
  assert.equal(node.connectable, false);
  assert.equal(node.style.pointerEvents, 'all');
  assert.equal(node.zIndex, 3);
  assert.deepEqual(node.measured, { width: 336, height: 284 });
});

test('React Flow Pack nodes retain domain Pack id and enable Flow drag', () => {
  const entry = { type: 'group', id: 'pack-1', task: { id: 7 }, tasks: [], x: 30, y: 40 };
  const node = toReactFlowNode(entry);

  assert.equal(node.id, 'pack:pack-1');
  assert.equal(node.type, 'intodayPack');
  assert.deepEqual(node.position, { x: 30, y: 40 });
  assert.equal(node.connectable, true);
  assert.equal(node.draggable, true);
  assert.equal(node.selectable, true);
});

test('domain selection maps Task and Pack nodes to their member Task ids', () => {
  const taskEntry = { type: 'task', task: { id: 1 }, x: 0, y: 0 };
  const packEntry = {
    type: 'group',
    id: 'pack-1',
    task: { id: 2 },
    tasks: [{ id: 2 }, { id: 3 }],
    x: 0,
    y: 0,
  };
  const taskNode = toReactFlowNode(taskEntry);
  const packNode = toReactFlowNode(packEntry);
  assert.deepEqual(
    getSelectedTaskIdsFromReactFlowNodes([
      taskNode,
      packNode,
    ]),
    [1, 2, 3],
  );
  assert.deepEqual(getSelectedTaskIdsFromReactFlowNodes([]), []);
});

test('React Flow edges map domain endpoint sides and omit missing Packs', () => {
  const connection = {
    id: 'connection:ws:a:b',
    sourceGroupId: 'a',
    sourceSide: 'left',
    targetGroupId: 'b',
    targetSide: 'right',
  };
  const edge = toReactFlowEdge(connection);

  assert.equal(edge.id, connection.id);
  assert.equal(edge.source, 'pack:a');
  assert.equal(edge.sourceHandle, 'left');
  assert.equal(edge.target, 'pack:b');
  assert.equal(edge.targetHandle, 'right');
  assert.equal(edge.selectable, false);

  assert.deepEqual(
    toReactFlowEdges([connection], [{ type: 'group', id: 'a' }]),
    [],
  );
  const removeConnection = () => {};
  const edges = toReactFlowEdges(
    [connection],
    [{ type: 'group', id: 'a' }, { type: 'group', id: 'b' }],
    { onRemoveConnection: removeConnection },
  );
  assert.equal(edges.length, 1);
  assert.equal(edges[0].data.onRemoveConnection, removeConnection);

  for (const sourceSide of ['left', 'right']) {
    for (const targetSide of ['left', 'right']) {
      const sideMappedEdge = toReactFlowEdge({
        ...connection,
        sourceSide,
        targetSide,
      });
      assert.equal(sideMappedEdge.sourceHandle, sourceSide);
      assert.equal(sideMappedEdge.targetHandle, targetSide);
    }
  }
});
