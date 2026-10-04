import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCanvasFlowDragChanges } from '../model/canvasFlowDrag.js';

test('React Flow multi-selection drag changes only the node under the pointer', () => {
  const changes = [
    { id: 'task:a', type: 'position', position: { x: 10, y: 10 } },
    { id: 'task:b', type: 'position', position: { x: 20, y: 20 } },
    { id: 'task:b', type: 'select', selected: true },
  ];

  assert.deepEqual(
    filterCanvasFlowDragChanges(changes, 'task:a'),
    [changes[0], changes[2]],
  );
  assert.deepEqual(filterCanvasFlowDragChanges(changes, null), changes);
});
