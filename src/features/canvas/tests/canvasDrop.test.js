import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCanvasDrop, CANVAS_DROP_ACTIONS, reduceCanvasDrop } from '../model/canvasDrop.js';

test('canvas drop reducer moves every selected task from preview positions', () => {
  const action = calculateCanvasDrop({
    draggedIds: [1, 2],
    originPositions: { 1: { x: 10, y: 20 }, 2: { x: 30, y: 40 } },
    previewPositions: { 1: { x: 110.26, y: 220.84 }, 2: { x: 130.26, y: 240.84 } },
    activeDateKey: '2026-09-11',
    timestamp: 99,
    detachFromPack: false,
    overlapEntry: null,
    isReturningToPack: false,
  });

  assert.equal(action.type, CANVAS_DROP_ACTIONS.MOVE);
  const tasks = reduceCanvasDrop([{ id: 1 }, { id: 2 }, { id: 3 }], action);
  assert.deepEqual(tasks.slice(0, 2).map((task) => [task.desktopCanvasX, task.desktopCanvasY]), [
    [110.3, 220.8],
    [130.3, 240.8],
  ]);
  assert.strictEqual(tasks[2].id, 3);
});

test('canvas drop reducer clears Pack metadata only for a detached single task', () => {
  const action = calculateCanvasDrop({
    draggedIds: [1],
    originPositions: { 1: { x: 10, y: 20 } },
    previewPositions: { 1: { x: 90, y: 120 } },
    activeDateKey: '2026-09-11',
    timestamp: 99,
    detachFromPack: true,
    overlapEntry: null,
    isReturningToPack: false,
  });
  const [task] = reduceCanvasDrop([{
    id: 1,
    desktopGroupId: 'pack-a',
    desktopGroupName: 'Pack A',
    desktopGroupTags: ['Demo'],
  }], action);
  assert.equal(task.desktopGroupId, null);
  assert.equal(task.desktopGroupName, null);
  assert.deepEqual(task.desktopGroupTags, []);
});
