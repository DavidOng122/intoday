import test from 'node:test';
import assert from 'node:assert/strict';
import { getClampedCanvasDragPosition } from '../model/canvasDragPosition.js';

test('drag position preserves multi-selection offsets while clamping the whole selection', () => {
  const result = getClampedCanvasDragPosition({
    rawPosition: { x: 900, y: 90 },
    anchorPosition: { x: 100, y: 40 },
    originPositions: [{ x: 100, y: 40 }, { x: 200, y: 60 }],
    canvasBounds: { width: 600, height: 300 },
    height: 92,
  });
  assert.deepEqual(result, {
    position: { x: 164, y: 90 },
    delta: { x: 64, y: 50 },
  });
});

test('drag position does not allow a single card beyond the top-left canvas edge', () => {
  const result = getClampedCanvasDragPosition({
    rawPosition: { x: -10, y: -20 },
    anchorPosition: { x: 50, y: 30 },
    originPositions: [{ x: 50, y: 30 }],
    canvasBounds: { width: 600, height: 300 },
  });
  assert.deepEqual(result.position, { x: 0, y: 0 });
  assert.deepEqual(result.delta, { x: -50, y: -30 });
});
