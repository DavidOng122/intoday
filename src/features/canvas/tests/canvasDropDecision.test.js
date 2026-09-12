import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCanvasDrop } from '../model/canvasDropDecision.js';

test('drop decision creates a prompt payload only for a confirmed overlap', () => {
  const tasks = [
    { id: 1, text: 'Dragged', desktopCanvasX: 10, desktopCanvasY: 20 },
    { id: 2, text: 'Target', desktopCanvasX: 200, desktopCanvasY: 100 },
  ];
  const result = decideCanvasDrop({
    tasks,
    movingTaskIds: new Set([1]),
    originPositions: { 1: { x: 10, y: 20 } },
    anchorPosition: { x: 10, y: 20 },
    nextPosition: { x: 180, y: 100 },
    delta: { x: 170, y: 80 },
    activeDateKey: '2026-09-12',
    timestamp: 123,
    isGroupDrag: false,
    isDetachedGroupTask: false,
    overlapEntry: { type: 'task', task: tasks[1], x: 200, y: 100 },
  });
  assert.equal(result.prompt.mode, 'create-group');
  assert.deepEqual(result.prompt.movingTaskIds, [1]);
  assert.deepEqual(result.prompt.targetTaskIds, [2]);
  assert.equal(result.drop.type, 'PROMPT_GROUP');
});

test('drop decision immediately returns a Pack member to its own Pack', () => {
  const tasks = [{ id: 1, desktopGroupId: 'pack-a', desktopCanvasX: 10, desktopCanvasY: 20 }];
  const result = decideCanvasDrop({
    tasks,
    movingTaskIds: new Set([1]),
    originPositions: { 1: { x: 10, y: 20 } },
    anchorPosition: { x: 10, y: 20 },
    nextPosition: { x: 100, y: 100 },
    delta: { x: 90, y: 80 },
    activeDateKey: '2026-09-12',
    timestamp: 123,
    isGroupDrag: false,
    isDetachedGroupTask: true,
    overlapEntry: { type: 'group', id: 'pack-a', tasks, x: 100, y: 100 },
  });
  assert.equal(result.prompt, null);
  assert.equal(result.drop.type, 'RETURN_TO_PACK');
});
