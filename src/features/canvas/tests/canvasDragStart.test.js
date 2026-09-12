import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasDragStart } from '../model/canvasDragStart.js';

test('drag start uses the Inbox source position when the item has no Canvas entry yet', () => {
  const task = { id: 'inbox-1', collectionState: 'inbox', text: 'Inbox item' };
  const result = buildCanvasDragStart({
    task,
    selectedTaskIds: new Set(['inbox-1']),
    entries: [],
    tasks: [task],
    sourceCanvasPosition: { x: 640, y: 180 },
  });

  assert.deepEqual(result.anchorPosition, { x: 640, y: 180 });
  assert.deepEqual(result.originPositions.get('inbox-1'), { x: 640, y: 180 });
  assert.deepEqual(result.overlaySnapshot.task, task);
  assert.equal(result.overlaySnapshot.type, 'task');
});

test('drag start snapshots every Pack member at the Pack anchor position', () => {
  const tasks = [
    { id: 1, desktopGroupId: 'pack-a', text: 'First' },
    { id: 2, desktopGroupId: 'pack-a', text: 'Second' },
  ];
  const entry = {
    type: 'group',
    id: 'pack-a',
    task: tasks[0],
    tasks,
    x: 220,
    y: 140,
  };
  const result = buildCanvasDragStart({
    task: { ...tasks[0], isGroupInitiator: true, groupTaskIds: [1, 2] },
    selectedTaskIds: new Set([1, 2]),
    entries: [entry],
    tasks,
    sourceCanvasPosition: null,
  });

  assert.equal(result.isGroup, true);
  assert.deepEqual(result.movingTaskIds, [1, 2]);
  assert.deepEqual(result.originPositions.get(1), { x: 220, y: 140 });
  assert.deepEqual(result.originPositions.get(2), { x: 220, y: 140 });
  assert.deepEqual(result.overlaySnapshot.tasks, tasks);
});
