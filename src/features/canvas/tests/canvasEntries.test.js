import test from 'node:test';
import assert from 'node:assert/strict';

import {
  constrainDesktopCanvasEntries,
  getDefaultDesktopCanvasPosition,
  getNextDesktopCanvasPosition,
  resolveDesktopCanvasEntries,
} from '../model/canvasEntries.js';
import {
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';

test('getDefaultDesktopCanvasPosition lays cards out in two columns', () => {
  assert.deepEqual(getDefaultDesktopCanvasPosition(0), { x: 0, y: 0 });
  assert.deepEqual(getDefaultDesktopCanvasPosition(1), {
    x: DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP,
    y: 0,
  });
  assert.deepEqual(getDefaultDesktopCanvasPosition(2), {
    x: 0,
    y: DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP,
  });
});

test('constrainDesktopCanvasEntries clamps cards to every finite canvas edge', () => {
  const bounds = { width: 1008, height: 560 };
  const entries = [
    { type: 'task', task: { id: 1 }, x: -120, y: -40 },
    { type: 'task', task: { id: 2 }, x: 4000, y: 3000 },
  ];

  const constrained = constrainDesktopCanvasEntries(entries, bounds);
  assert.deepEqual({ x: constrained[0].x, y: constrained[0].y }, { x: 0, y: 0 });
  assert.deepEqual(
    { x: constrained[1].x, y: constrained[1].y },
    { x: 672, y: 468 },
  );
});

test('resolveDesktopCanvasEntries moves duplicate saved positions below existing cards', () => {
  const entries = resolveDesktopCanvasEntries([
    { id: 1, desktopCanvasX: 10, desktopCanvasY: 20 },
    { id: 2, desktopCanvasX: 10, desktopCanvasY: 20 },
  ]);

  assert.deepEqual({ x: entries[0].x, y: entries[0].y }, { x: 10, y: 20 });
  assert.equal(entries[1].x, 0);
  assert.ok(entries[1].y > entries[0].y);
});

test('getNextDesktopCanvasPosition is below the lowest production entry', () => {
  assert.deepEqual(getNextDesktopCanvasPosition([]), { x: 0, y: 0 });
  assert.deepEqual(
    getNextDesktopCanvasPosition([{ id: 1, desktopCanvasX: 0, desktopCanvasY: 0 }]),
    { x: 0, y: DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP },
  );
});
