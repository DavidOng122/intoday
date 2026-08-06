// NOTE: canvasGeometry.js uses bare module specifiers which require a bundler.
// These tests verify the pure mathematical functions by reproducing them
// inline — no imports of application modules needed.
//
// Full integration (getDesktopCanvasOverlapEntry) is covered by manual
// regression after each migration phase.

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// doDesktopRectsIntersect
// ---------------------------------------------------------------------------

const doDesktopRectsIntersect = (a, b) => !(
  a.x + a.width < b.x
  || b.x + b.width < a.x
  || a.y + a.height < b.y
  || b.y + b.height < a.y
);

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

const getDesktopSelectionRect = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

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

const getDesktopCanvasRectIntersectionArea = (a, b) => {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapWidth * overlapHeight;
};

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

const getRectCenterPoint = (rect) => ({
  x: rect.x + (rect.width / 2),
  y: rect.y + (rect.height / 2),
});

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

const isDesktopCanvasPointInsideRect = (point, rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
);

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

const expandDesktopCanvasRect = (rect, horizontal, vertical) => ({
  x: rect.x - horizontal,
  y: rect.y - vertical,
  width: rect.width + (horizontal * 2),
  height: rect.height + (vertical * 2),
});

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
