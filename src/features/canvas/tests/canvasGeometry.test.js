import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doDesktopRectsIntersect,
  getDesktopSelectionRect,
  getDesktopCanvasRectIntersectionArea,
  getRectCenterPoint,
  isDesktopCanvasPointInsideRect,
  expandDesktopCanvasRect,
  findDesktopDragOverlap,
} from '../model/canvasGeometry.js';
import { getCanvasEntryIdentity } from '../model/canvasEntries.js';

// ---------------------------------------------------------------------------
// doDesktopRectsIntersect
// ---------------------------------------------------------------------------

test('doDesktopRectsIntersect: overlapping rects', () => {
  assert.equal(doDesktopRectsIntersect(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 50, y: 50, width: 100, height: 100 },
  ), true);
});

test('doDesktopRectsIntersect: touching edge', () => {
  assert.equal(doDesktopRectsIntersect(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 100, y: 0, width: 100, height: 100 },
  ), true);
});

test('doDesktopRectsIntersect: separate rects horizontally', () => {
  assert.equal(doDesktopRectsIntersect(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 200, y: 0, width: 100, height: 100 },
  ), false);
});

test('doDesktopRectsIntersect: separate rects vertically', () => {
  assert.equal(doDesktopRectsIntersect(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 0, y: 200, width: 100, height: 100 },
  ), false);
});

// ---------------------------------------------------------------------------
// getDesktopSelectionRect
// ---------------------------------------------------------------------------

test('getDesktopSelectionRect: top-left to bottom-right', () => {
  const r = getDesktopSelectionRect({ x: 10, y: 20 }, { x: 110, y: 120 });
  assert.equal(r.x, 10);
  assert.equal(r.y, 20);
  assert.equal(r.width, 100);
  assert.equal(r.height, 100);
});

test('getDesktopSelectionRect: reversed drag', () => {
  const r = getDesktopSelectionRect({ x: 110, y: 120 }, { x: 10, y: 20 });
  assert.equal(r.x, 10);
  assert.equal(r.y, 20);
  assert.equal(r.width, 100);
  assert.equal(r.height, 100);
});

test('getDesktopSelectionRect: zero-size selection', () => {
  const r = getDesktopSelectionRect({ x: 50, y: 50 }, { x: 50, y: 50 });
  assert.equal(r.width, 0);
  assert.equal(r.height, 0);
});

// ---------------------------------------------------------------------------
// getDesktopCanvasRectIntersectionArea
// ---------------------------------------------------------------------------

test('getDesktopCanvasRectIntersectionArea: identical rects', () => {
  const r = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(getDesktopCanvasRectIntersectionArea(r, r), 10000);
});

test('getDesktopCanvasRectIntersectionArea: partial overlap', () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };
  const b = { x: 50, y: 50, width: 100, height: 100 };
  assert.equal(getDesktopCanvasRectIntersectionArea(a, b), 2500);
});

test('getDesktopCanvasRectIntersectionArea: no overlap returns 0', () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };
  const b = { x: 200, y: 200, width: 100, height: 100 };
  assert.equal(getDesktopCanvasRectIntersectionArea(a, b), 0);
});

// ---------------------------------------------------------------------------
// getRectCenterPoint
// ---------------------------------------------------------------------------

test('getRectCenterPoint: centered at origin', () => {
  const c = getRectCenterPoint({ x: 0, y: 0, width: 100, height: 80 });
  assert.equal(c.x, 50);
  assert.equal(c.y, 40);
});

test('getRectCenterPoint: offset rect', () => {
  const c = getRectCenterPoint({ x: 100, y: 200, width: 60, height: 40 });
  assert.equal(c.x, 130);
  assert.equal(c.y, 220);
});

// ---------------------------------------------------------------------------
// isDesktopCanvasPointInsideRect
// ---------------------------------------------------------------------------

test('isDesktopCanvasPointInsideRect: center is inside', () => {
  assert.equal(isDesktopCanvasPointInsideRect({ x: 50, y: 50 }, { x: 0, y: 0, width: 100, height: 100 }), true);
});

test('isDesktopCanvasPointInsideRect: boundary points are inside', () => {
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(isDesktopCanvasPointInsideRect({ x: 0, y: 0 }, rect), true);
  assert.equal(isDesktopCanvasPointInsideRect({ x: 100, y: 100 }, rect), true);
});

test('isDesktopCanvasPointInsideRect: outside returns false', () => {
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(isDesktopCanvasPointInsideRect({ x: 101, y: 50 }, rect), false);
  assert.equal(isDesktopCanvasPointInsideRect({ x: 50, y: 101 }, rect), false);
});

// ---------------------------------------------------------------------------
// expandDesktopCanvasRect
// ---------------------------------------------------------------------------

test('expandDesktopCanvasRect: expands all sides symmetrically', () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  const expanded = expandDesktopCanvasRect(rect, 10, 18);
  assert.equal(expanded.x, 90);
  assert.equal(expanded.y, 82);
  assert.equal(expanded.width, 220);
  assert.equal(expanded.height, 136);
});

test('expandDesktopCanvasRect: zero padding is identity', () => {
  const rect = { x: 50, y: 60, width: 100, height: 80 };
  assert.deepEqual(expandDesktopCanvasRect(rect, 0, 0), rect);
});

// ---------------------------------------------------------------------------
// findDesktopDragOverlap (Production Import)
// ---------------------------------------------------------------------------

test('findDesktopDragOverlap: no candidates returns null', () => {
  const result = findDesktopDragOverlap({
    movingRect: { x: 0, y: 0, width: 220, height: 120 },
    candidates: [],
    movingTaskIds: new Set([1]),
  });
  assert.equal(result, null);
});

test('findDesktopDragOverlap: ignores candidate with exact same task IDs', () => {
  const entry = { type: 'task', task: { id: 1 }, x: 0, y: 0 };
  const rect = { x: 0, y: 0, width: 220, height: 120 };
  const result = findDesktopDragOverlap({
    movingRect: { x: 0, y: 0, width: 220, height: 120 },
    candidates: [{ entry, rect }],
    movingTaskIds: new Set([1]),
  });
  assert.equal(result, null);
});

test('findDesktopDragOverlap: threshold boundary - below threshold returns null', () => {
  const entry = { type: 'task', task: { id: 2 }, x: 300, y: 300 };
  const rect = { x: 300, y: 300, width: 220, height: 120 };
  const result = findDesktopDragOverlap({
    movingRect: { x: 0, y: 0, width: 220, height: 120 },
    candidates: [{ entry, rect }],
    movingTaskIds: new Set([1]),
    threshold: 0.5,
  });
  assert.equal(result, null);
});

test('findDesktopDragOverlap: overlap above threshold returns best match', () => {
  const entryA = { type: 'task', task: { id: 2 }, x: 50, y: 50 };
  const rectA = { x: 50, y: 50, width: 220, height: 120 };
  const entryB = { type: 'task', task: { id: 3 }, x: 10, y: 10 };
  const rectB = { x: 10, y: 10, width: 220, height: 120 };

  const result = findDesktopDragOverlap({
    movingRect: { x: 0, y: 0, width: 220, height: 120 },
    candidates: [{ entry: entryA, rect: rectA }, { entry: entryB, rect: rectB }],
    movingTaskIds: new Set([1]),
    threshold: 0.5,
  });

  assert.notEqual(result, null);
  assert.equal(result.entry.task.id, 3);
  assert.equal(result.centerAligned, true);
});

test('findDesktopDragOverlap: single task vs tall Pack candidate', () => {
  const packEntry = {
    type: 'group',
    id: 'group-1',
    task: { id: 10 },
    tasks: [{ id: 10 }, { id: 11 }, { id: 12 }],
    x: 0,
    y: 0,
  };
  const packRect = { x: 0, y: 0, width: 220, height: 320 }; // taller Pack height

  const result = findDesktopDragOverlap({
    movingRect: { x: 20, y: 20, width: 220, height: 120 },
    candidates: [{ entry: packEntry, rect: packRect }],
    movingTaskIds: new Set([99]),
    threshold: 0.5,
  });

  assert.notEqual(result, null);
  assert.equal(result.entry.id, 'group-1');
  assert.equal(result.centerAligned, true);
});

// ---------------------------------------------------------------------------
// getCanvasEntryIdentity & Group-to-Group Overlap
// ---------------------------------------------------------------------------

test('getCanvasEntryIdentity: standalone task returns task.id', () => {
  const taskEntry = { type: 'task', task: { id: 42 }, x: 0, y: 0 };
  assert.equal(getCanvasEntryIdentity(taskEntry), 42);
});

test('getCanvasEntryIdentity: group entry returns entry.id', () => {
  const groupEntry = { type: 'group', id: 'desktop-group-99', task: { id: 1 }, tasks: [{ id: 1 }], x: 0, y: 0 };
  assert.equal(getCanvasEntryIdentity(groupEntry), 'desktop-group-99');
});

test('findDesktopDragOverlap: Group A overlapping Group B > 50% returns Group B candidate', () => {
  const groupB = {
    type: 'group',
    id: 'group-B',
    task: { id: 20 },
    tasks: [{ id: 20 }, { id: 21 }],
    x: 100,
    y: 100,
  };
  const groupBRect = { x: 100, y: 100, width: 220, height: 200 };

  const movingRect = { x: 120, y: 110, width: 220, height: 180 };

  const result = findDesktopDragOverlap({
    movingRect,
    candidates: [{ entry: groupB, rect: groupBRect }],
    movingTaskIds: new Set([10, 11]), // Group A moving task IDs
    threshold: 0.5,
  });

  assert.notEqual(result, null);
  assert.equal(result.entry.id, 'group-B');
});

test('findDesktopDragOverlap: Group A overlapping Group B < 50% returns null', () => {
  const groupB = {
    type: 'group',
    id: 'group-B',
    task: { id: 20 },
    tasks: [{ id: 20 }, { id: 21 }],
    x: 100,
    y: 100,
  };
  const groupBRect = { x: 100, y: 100, width: 220, height: 200 };

  const movingRect = { x: 400, y: 400, width: 220, height: 180 };

  const result = findDesktopDragOverlap({
    movingRect,
    candidates: [{ entry: groupB, rect: groupBRect }],
    movingTaskIds: new Set([10, 11]),
    threshold: 0.5,
  });

  assert.equal(result, null);
});
