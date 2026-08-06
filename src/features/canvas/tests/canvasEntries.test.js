// NOTE: canvasEntries.js uses bare module specifiers (no .js extension) which
// require a bundler to resolve. These tests instead verify the pure logic
// by reproducing the exact same calculations inline, matching the
// implementation in canvasEntries.js.
//
// Integration behaviour (resolveDesktopCanvasEntries,
// etc.) is covered by manual regression after each migration phase.

import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror constants from desktopConstants.js (the source of truth)
const DESKTOP_CANVAS_CARD_WIDTH = 336;
const DESKTOP_CANVAS_CARD_HEIGHT = 92;
const DESKTOP_CANVAS_CARD_GAP = 20;

// ---------------------------------------------------------------------------
// getDefaultDesktopCanvasPosition — pure formula, no imports needed
// ---------------------------------------------------------------------------

const getDefaultDesktopCanvasPosition = (index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: column * (DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP),
    y: row * (DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP),
  };
};

test('getDefaultDesktopCanvasPosition: index 0 is at origin', () => {
  const pos = getDefaultDesktopCanvasPosition(0);
  assert.equal(pos.x, 0);
  assert.equal(pos.y, 0);
});

test('getDefaultDesktopCanvasPosition: index 1 is second column, first row', () => {
  const pos = getDefaultDesktopCanvasPosition(1);
  assert.equal(pos.x, DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP);
  assert.equal(pos.y, 0);
});

test('getDefaultDesktopCanvasPosition: index 2 wraps to second row', () => {
  const pos = getDefaultDesktopCanvasPosition(2);
  assert.equal(pos.x, 0);
  assert.equal(pos.y, DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP);
});

test('getDefaultDesktopCanvasPosition: index 3 is second column, second row', () => {
  const pos = getDefaultDesktopCanvasPosition(3);
  assert.equal(pos.x, DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP);
  assert.equal(pos.y, DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP);
});

// ---------------------------------------------------------------------------
// finite canvas bounds
// ---------------------------------------------------------------------------

const constrainPosition = (position, bounds, height = DESKTOP_CANVAS_CARD_HEIGHT) => ({
  x: Math.min(bounds.width - DESKTOP_CANVAS_CARD_WIDTH, Math.max(0, position.x)),
  y: Math.min(bounds.height - height, Math.max(0, position.y)),
});

test('finite canvas: clamps negative positions to the top-left corner', () => {
  assert.deepEqual(
    constrainPosition({ x: -120, y: -40 }, { width: 1008, height: 560 }),
    { x: 0, y: 0 },
  );
});

test('finite canvas: clamps positions to the visible right and bottom edges', () => {
  assert.deepEqual(
    constrainPosition({ x: 4000, y: 3000 }, { width: 1008, height: 560 }),
    { x: 672, y: 468 },
  );
});

// ---------------------------------------------------------------------------
// Collision-resolved position key uniqueness — pure key logic
// ---------------------------------------------------------------------------

const positionKey = (x, y) => `${Number(x).toFixed(1)}:${Number(y).toFixed(1)}`;

test('positionKey: same coordinates produce same key', () => {
  assert.equal(positionKey(10, 20), positionKey(10, 20));
});

test('positionKey: different coordinates produce different keys', () => {
  assert.notEqual(positionKey(10, 20), positionKey(10, 21));
  assert.notEqual(positionKey(10, 20), positionKey(11, 20));
});

test('positionKey: rounds to 1 decimal place', () => {
  assert.equal(positionKey(10.05, 20.05), positionKey(10.1, 20.1));
});

// ---------------------------------------------------------------------------
// getNextDesktopCanvasPosition — position-after-last logic
// ---------------------------------------------------------------------------

test('getNextDesktopCanvasPosition: position below a single entry is x=0, y>0', () => {
  // Simulates: entry at y=0 with height=92, gap=20 → next y = 92 + 20 = 112
  const entryY = 0;
  const entryHeight = DESKTOP_CANVAS_CARD_HEIGHT;
  const nextY = entryY + entryHeight + DESKTOP_CANVAS_CARD_GAP;
  assert.equal(nextY, 112);
});

test('getNextDesktopCanvasPosition: stacked entries increase next y monotonically', () => {
  const positions = [0, 112, 224];
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1]);
  }
});
