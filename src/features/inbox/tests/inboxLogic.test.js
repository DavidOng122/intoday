import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_STATES,
  normalizeCollectionState,
} from '../model/collectionState.js';
import {
  createInboxTask,
  getInboxCount,
  getInboxItems,
  getLibraryItems,
  isInboxItem,
  isLibraryItem,
  moveInboxItemToPack,
  placeInboxItem,
  removeItemFromPack,
} from '../model/inboxLogic.js';

// ---------------------------------------------------------------------------
// collectionState constants
// ---------------------------------------------------------------------------

test('COLLECTION_STATES has INBOX and LIBRARY', () => {
  assert.equal(COLLECTION_STATES.INBOX, 'inbox');
  assert.equal(COLLECTION_STATES.LIBRARY, 'library');
});

test('normalizeCollectionState: inbox string returns inbox', () => {
  assert.equal(normalizeCollectionState('inbox'), 'inbox');
});

test('normalizeCollectionState: library string returns library', () => {
  assert.equal(normalizeCollectionState('library'), 'library');
});

test('normalizeCollectionState: null defaults to library', () => {
  assert.equal(normalizeCollectionState(null), 'library');
});

test('normalizeCollectionState: undefined defaults to library', () => {
  assert.equal(normalizeCollectionState(undefined), 'library');
});

test('normalizeCollectionState: invalid string defaults to library', () => {
  assert.equal(normalizeCollectionState('archive'), 'library');
  assert.equal(normalizeCollectionState(''), 'library');
  assert.equal(normalizeCollectionState(0), 'library');
});

// ---------------------------------------------------------------------------
// isInboxItem / isLibraryItem
// ---------------------------------------------------------------------------

test('isInboxItem: returns true for inbox state', () => {
  assert.equal(isInboxItem({ collectionState: 'inbox' }), true);
});

test('isInboxItem: returns false for library state', () => {
  assert.equal(isInboxItem({ collectionState: 'library' }), false);
});

test('isInboxItem: returns false for missing collectionState (legacy data)', () => {
  assert.equal(isInboxItem({ id: 1 }), false);
  assert.equal(isInboxItem({}), false);
});

test('isInboxItem: returns false for null', () => {
  assert.equal(isInboxItem(null), false);
});

test('isLibraryItem: inverse of isInboxItem', () => {
  assert.equal(isLibraryItem({ collectionState: 'library' }), true);
  assert.equal(isLibraryItem({ collectionState: 'inbox' }), false);
  // legacy data defaults to library
  assert.equal(isLibraryItem({ id: 1 }), true);
});

// ---------------------------------------------------------------------------
// getInboxItems / getLibraryItems / getInboxCount
// ---------------------------------------------------------------------------

test('getInboxItems: empty array', () => {
  assert.deepEqual(getInboxItems([]), []);
});

test('getLibraryItems: empty array', () => {
  assert.deepEqual(getLibraryItems([]), []);
});

test('getInboxCount: empty array returns 0', () => {
  assert.equal(getInboxCount([]), 0);
});

test('getInboxItems: returns only inbox tasks sorted by id desc', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    { id: 2, collectionState: 'library' },
    { id: 3, collectionState: 'inbox' },
    { id: 4, collectionState: 'inbox' },
  ];
  const inbox = getInboxItems(tasks);
  assert.deepEqual(inbox.map((t) => t.id), [4, 3, 1]);
});

test('getLibraryItems: returns all non-inbox tasks including legacy', () => {
  const tasks = [
    { id: 1, collectionState: 'library' },
    { id: 2, collectionState: 'inbox' },
    { id: 3 }, // legacy — no collectionState
  ];
  const library = getLibraryItems(tasks);
  assert.deepEqual(library.map((t) => t.id).sort(), [1, 3]);
});

test('getInboxCount: counts only inbox items', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    { id: 2, collectionState: 'library' },
    { id: 3, collectionState: 'inbox' },
    { id: 4 }, // legacy
  ];
  assert.equal(getInboxCount(tasks), 2);
});

test('getInboxItems + getLibraryItems: together cover all tasks', () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    collectionState: i % 2 === 0 ? 'inbox' : 'library',
  }));
  const inbox = getInboxItems(tasks);
  const library = getLibraryItems(tasks);
  assert.equal(inbox.length + library.length, tasks.length);
});

// ---------------------------------------------------------------------------
// createInboxTask
// ---------------------------------------------------------------------------

test('createInboxTask: sets collectionState to inbox', () => {
  const task = createInboxTask({ id: 1, text: 'Hello' });
  assert.equal(task.collectionState, 'inbox');
});

test('createInboxTask: clears canvas coordinates', () => {
  const task = createInboxTask({ id: 1, desktopCanvasX: 100, desktopCanvasY: 200 });
  assert.equal(task.desktopCanvasX, null);
  assert.equal(task.desktopCanvasY, null);
  assert.equal(task.desktopSlot, null);
});

test('createInboxTask: clears all pack fields', () => {
  const task = createInboxTask({
    id: 1,
    desktopGroupId: 'g1',
    desktopGroupName: 'Pack',
    desktopGroupIcon: '📦',
    desktopGroupCover: 'url',
    desktopGroupTags: ['tag1'],
    desktopGroupActiveDurationType: 'range',
    desktopGroupActiveFrom: '2024-01-01',
    desktopGroupActiveUntil: '2024-12-31',
  });
  assert.equal(task.desktopGroupId, null);
  assert.equal(task.desktopGroupName, null);
  assert.equal(task.desktopGroupIcon, null);
  assert.equal(task.desktopGroupCover, null);
  assert.deepEqual(task.desktopGroupTags, []);
  assert.equal(task.desktopGroupActiveDurationType, null);
  assert.equal(task.desktopGroupActiveFrom, null);
  assert.equal(task.desktopGroupActiveUntil, null);
});

test('createInboxTask: preserves other task fields', () => {
  const task = createInboxTask({ id: 42, text: 'Link', cardType: 'link', primaryUrl: 'https://example.com' });
  assert.equal(task.id, 42);
  assert.equal(task.text, 'Link');
  assert.equal(task.cardType, 'link');
  assert.equal(task.primaryUrl, 'https://example.com');
});

test('createInboxTask: does not mutate input', () => {
  const input = { id: 1, collectionState: 'library', desktopCanvasX: 50 };
  createInboxTask(input);
  assert.equal(input.collectionState, 'library');
  assert.equal(input.desktopCanvasX, 50);
});

// ---------------------------------------------------------------------------
// placeInboxItem
// ---------------------------------------------------------------------------

test('placeInboxItem: promotes to library with position', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  const next = placeInboxItem(tasks, 1, { x: 100, y: 200 }, 'ts-1');
  assert.equal(next[0].collectionState, 'library');
  assert.equal(next[0].desktopCanvasX, 100);
  assert.equal(next[0].desktopCanvasY, 200);
  assert.equal(next[0].updatedAt, 'ts-1');
});

test('placeInboxItem: uses provided desktopZ from position', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  const next = placeInboxItem(tasks, 1, { x: 0, y: 0, z: 9999 });
  assert.equal(next[0].desktopZ, 9999);
});

test('placeInboxItem: defaults desktopZ when not provided', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  const before = Date.now();
  const next = placeInboxItem(tasks, 1, { x: 0, y: 0 });
  const after = Date.now();
  assert.ok(next[0].desktopZ >= before && next[0].desktopZ <= after);
});

test('placeInboxItem: clears pack fields', () => {
  const tasks = [{ id: 1, collectionState: 'inbox', desktopGroupId: 'g1', desktopGroupName: 'X' }];
  const next = placeInboxItem(tasks, 1, { x: 0, y: 0 });
  assert.equal(next[0].desktopGroupId, null);
  assert.equal(next[0].desktopGroupName, null);
});

test('placeInboxItem: throws if task not found', () => {
  assert.throws(() => placeInboxItem([], 99, { x: 0, y: 0 }), /was not found/);
});

test('placeInboxItem: throws if task is not inbox', () => {
  const tasks = [{ id: 1, collectionState: 'library' }];
  assert.throws(() => placeInboxItem(tasks, 1, { x: 0, y: 0 }), /not in Inbox/);
});

test('placeInboxItem: throws for invalid position', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  assert.throws(() => placeInboxItem(tasks, 1, { x: 'bad', y: 0 }), /finite canvas position/);
  assert.throws(() => placeInboxItem(tasks, 1, null), /finite canvas position/);
});

test('placeInboxItem: does not mutate input tasks array', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  placeInboxItem(tasks, 1, { x: 0, y: 0 });
  assert.equal(tasks[0].collectionState, 'inbox');
});

// ---------------------------------------------------------------------------
// moveInboxItemToPack
// ---------------------------------------------------------------------------

test('moveInboxItemToPack: inherits pack metadata and canvas position', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    {
      id: 2, collectionState: 'library',
      desktopGroupId: 'g1', desktopGroupName: 'Research',
      desktopGroupIcon: '🔬', desktopGroupCover: 'cover.jpg',
      desktopGroupTags: ['science'],
      desktopGroupActiveDurationType: null,
      desktopGroupActiveFrom: null,
      desktopGroupActiveUntil: null,
      desktopCanvasX: 300, desktopCanvasY: 400, desktopZ: 5,
    },
  ];
  const next = moveInboxItemToPack(tasks, 1, 'g1', 'ts-move');
  assert.equal(next[0].collectionState, 'library');
  assert.equal(next[0].desktopGroupId, 'g1');
  assert.equal(next[0].desktopGroupName, 'Research');
  assert.equal(next[0].desktopGroupIcon, '🔬');
  assert.equal(next[0].desktopCanvasX, 300);
  assert.equal(next[0].desktopZ, 5);
  assert.equal(next[0].updatedAt, 'ts-move');
});

test('moveInboxItemToPack: throws if task not found', () => {
  const tasks = [{ id: 2, collectionState: 'library', desktopGroupId: 'g1' }];
  assert.throws(() => moveInboxItemToPack(tasks, 99, 'g1'), /was not found/);
});

test('moveInboxItemToPack: throws if task is not inbox', () => {
  const tasks = [
    { id: 1, collectionState: 'library', desktopGroupId: null },
    { id: 2, collectionState: 'library', desktopGroupId: 'g1' },
  ];
  assert.throws(() => moveInboxItemToPack(tasks, 1, 'g1'), /not in Inbox/);
});

test('moveInboxItemToPack: throws if target pack does not exist', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  assert.throws(() => moveInboxItemToPack(tasks, 1, 'missing-pack'), /was not found/);
});

test('moveInboxItemToPack: throws if target pack is not library', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    { id: 2, collectionState: 'inbox', desktopGroupId: 'g1' },
  ];
  assert.throws(() => moveInboxItemToPack(tasks, 1, 'g1'), /was not found/);
});

test('moveInboxItemToPack: does not mutate input', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    { id: 2, collectionState: 'library', desktopGroupId: 'g1', desktopGroupName: 'P', desktopCanvasX: 0, desktopCanvasY: 0, desktopZ: 1 },
  ];
  moveInboxItemToPack(tasks, 1, 'g1');
  assert.equal(tasks[0].collectionState, 'inbox');
});

// ---------------------------------------------------------------------------
// removeItemFromPack
// ---------------------------------------------------------------------------

test('removeItemFromPack: clears pack fields and sets canvas position', () => {
  const tasks = [{ id: 1, collectionState: 'library', desktopGroupId: 'g1', desktopGroupName: 'P' }];
  const next = removeItemFromPack(tasks, 1, { x: 50, y: 60 }, 'ts-remove');
  assert.equal(next[0].collectionState, 'library');
  assert.equal(next[0].desktopGroupId, null);
  assert.equal(next[0].desktopGroupName, null);
  assert.equal(next[0].desktopCanvasX, 50);
  assert.equal(next[0].desktopCanvasY, 60);
  assert.equal(next[0].updatedAt, 'ts-remove');
});

test('removeItemFromPack: throws if task not in a pack', () => {
  const tasks = [{ id: 1, collectionState: 'library', desktopGroupId: null }];
  assert.throws(() => removeItemFromPack(tasks, 1, { x: 0, y: 0 }), /not in a Pack/);
});

test('removeItemFromPack: throws if task not found', () => {
  assert.throws(() => removeItemFromPack([], 99, { x: 0, y: 0 }), /was not found/);
});

test('removeItemFromPack: throws for invalid position', () => {
  const tasks = [{ id: 1, collectionState: 'library', desktopGroupId: 'g1' }];
  assert.throws(() => removeItemFromPack(tasks, 1, { x: null, y: 0 }), /finite canvas position/);
});

test('removeItemFromPack: does not mutate input', () => {
  const tasks = [{ id: 1, collectionState: 'library', desktopGroupId: 'g1' }];
  removeItemFromPack(tasks, 1, { x: 0, y: 0 });
  assert.equal(tasks[0].desktopGroupId, 'g1');
});

// ---------------------------------------------------------------------------
// Immutability: all state transitions return new arrays
// ---------------------------------------------------------------------------

test('placeInboxItem: returns new array reference', () => {
  const tasks = [{ id: 1, collectionState: 'inbox' }];
  const next = placeInboxItem(tasks, 1, { x: 0, y: 0 });
  assert.notStrictEqual(next, tasks);
});

test('moveInboxItemToPack: returns new array reference', () => {
  const tasks = [
    { id: 1, collectionState: 'inbox' },
    { id: 2, collectionState: 'library', desktopGroupId: 'g1', desktopGroupName: 'P', desktopCanvasX: 0, desktopCanvasY: 0, desktopZ: 1 },
  ];
  const next = moveInboxItemToPack(tasks, 1, 'g1');
  assert.notStrictEqual(next, tasks);
});

test('removeItemFromPack: returns new array reference', () => {
  const tasks = [{ id: 1, collectionState: 'library', desktopGroupId: 'g1' }];
  const next = removeItemFromPack(tasks, 1, { x: 0, y: 0 });
  assert.notStrictEqual(next, tasks);
});
