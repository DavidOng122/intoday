import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInboxCanvasDrop } from '../model/inboxCanvasDrop.js';

const bounds = { width: 1000, height: 700 };
const position = { x: 180, y: 140 };
const pointerPosition = { x: 220, y: 170 };

test('Inbox drop preserves the requested position regardless of standalone cards', () => {
  const standaloneEntries = [
    { type: 'task', x: 180, y: 140, task: { id: 'existing' } },
    { type: 'task', x: 500, y: 400, task: { id: 'other' } },
  ];
  assert.deepEqual(resolveInboxCanvasDrop({
    entries: standaloneEntries,
    position,
    pointerPosition,
    canvasBounds: bounds,
  }), { kind: 'canvas', position });
});

test('Inbox drop chooses a Pack only above the Pack overlap threshold', () => {
  const entries = [{
    type: 'group', id: 'pack-1', x: 180, y: 140, tasks: [{ id: 1 }, { id: 2 }],
  }];
  const result = resolveInboxCanvasDrop({ entries, position, pointerPosition, canvasBounds: bounds });
  assert.equal(result.kind, 'pack');
  assert.equal(result.packId, 'pack-1');
});

test('Inbox drop outside the finite Canvas is cancelled', () => {
  assert.deepEqual(resolveInboxCanvasDrop({
    entries: [], position, pointerPosition: { x: -1, y: 100 }, canvasBounds: bounds,
  }), { kind: 'cancelled' });
  assert.deepEqual(resolveInboxCanvasDrop({
    entries: [], position, pointerPosition: { x: 1001, y: 100 }, canvasBounds: bounds,
  }), { kind: 'cancelled' });
});

test('Inbox drop clamps only at Canvas edges', () => {
  const result = resolveInboxCanvasDrop({
    entries: [],
    position: { x: 980, y: 690 },
    pointerPosition: { x: 999, y: 699 },
    canvasBounds: bounds,
  });
  assert.deepEqual(result, { kind: 'canvas', position: { x: 664, y: 608 } });
});

test('already-scaled 90 percent Canvas coordinates are not transformed again', () => {
  const scaledPosition = { x: 270, y: 180 };
  assert.deepEqual(resolveInboxCanvasDrop({
    entries: [],
    position: scaledPosition,
    pointerPosition: { x: 300, y: 210 },
    canvasBounds: bounds,
  }), { kind: 'canvas', position: scaledPosition });
});
