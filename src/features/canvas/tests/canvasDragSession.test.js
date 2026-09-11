import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanvasDragSession,
  getCanvasDragTaskIds,
  getCanvasPreviewPositions,
} from '../model/canvasDragSession.js';

test('drag session uses the same draggedIds model for a Pack and a selection', () => {
  assert.deepEqual(getCanvasDragTaskIds({ id: 1 }), [1]);
  assert.deepEqual(getCanvasDragTaskIds({ id: 1, groupTaskIds: [1, 2, 3] }), [1, 2, 3]);

  const session = createCanvasDragSession({
    pointerId: 7,
    type: 'pack',
    draggedIds: [1, 2, 3],
    startPointer: { x: 100, y: 200 },
    originPositions: new Map([[1, { x: 10, y: 20 }], [2, { x: 10, y: 20 }], [3, { x: 10, y: 20 }]]),
  });
  assert.deepEqual(session.previewPositions, session.originPositions);
});

test('preview positions preserve each selected task offset', () => {
  const preview = getCanvasPreviewPositions({
    draggedIds: [1, 2],
    originPositions: new Map([[1, { x: 10, y: 20 }], [2, { x: 50, y: 70 }]]),
    delta: { x: 120, y: -10 },
  });
  assert.deepEqual(preview, {
    1: { x: 130, y: 10 },
    2: { x: 170, y: 60 },
  });
});
