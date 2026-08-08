import test from 'node:test';
import assert from 'node:assert/strict';
import { getPackDisplayName, resolvePackMetadata } from '../../../entities/pack/model/packSelectors.js';
import { restoreCancelledPackMerge } from '../model/packMerge.js';

test('getPackDisplayName uses the first valid stored pack name', () => {
  assert.equal(getPackDisplayName([
    { id: 1, desktopGroupName: '  Target Pack  ', text: 'First item' },
    { id: 2, text: 'Second item' },
  ]), 'Target Pack');
});

test('resolvePackMetadata finds valid metadata beyond the first task', () => {
  const metadata = resolvePackMetadata([
    {
      id: 1,
      desktopGroupName: 'Target Pack',
      desktopGroupIcon: null,
      desktopGroupCover: null,
      desktopGroupTags: [],
      dateString: '2026-08-10',
    },
    {
      id: 2,
      desktopGroupIcon: '⭐',
      desktopGroupCover: { id: 'gradient-1' },
      desktopGroupTags: ['Reference'],
      desktopGroupActiveDurationType: 'custom',
      desktopGroupActiveFrom: '2026-08-10',
      desktopGroupActiveUntil: '2026-08-20',
    },
  ]);

  assert.deepEqual(metadata, {
    desktopGroupName: 'Target Pack',
    desktopGroupIcon: '⭐',
    desktopGroupCover: { id: 'gradient-1' },
    desktopGroupTags: ['Reference'],
    desktopGroupActiveDurationType: 'custom',
    desktopGroupActiveFrom: '2026-08-10',
    desktopGroupActiveUntil: '2026-08-20',
    dateString: '2026-08-10',
  });
});

test('merge-packs cancellation moves only the source pack and preserves metadata', () => {
  const tasks = [
    { id: 1, desktopGroupId: 'source', desktopGroupName: 'Source', desktopCanvasX: 10, desktopCanvasY: 20 },
    { id: 2, desktopGroupId: 'source', desktopGroupName: 'Source', desktopCanvasX: 10, desktopCanvasY: 20 },
    { id: 3, desktopGroupId: 'target', desktopGroupName: 'Target', desktopCanvasX: 200, desktopCanvasY: 200 },
  ];
  const restored = restoreCancelledPackMerge(tasks, {
    mode: 'merge-packs',
    movingTaskIds: [1, 2],
    fallbackPosition: { x: 320.27, y: 410.84 },
  }, 999);

  assert.deepEqual(restored.slice(0, 2).map((task) => ({
    id: task.id,
    groupId: task.desktopGroupId,
    name: task.desktopGroupName,
    x: task.desktopCanvasX,
    y: task.desktopCanvasY,
    z: task.desktopZ,
  })), [
    { id: 1, groupId: 'source', name: 'Source', x: 320.3, y: 410.8, z: 999 },
    { id: 2, groupId: 'source', name: 'Source', x: 320.3, y: 410.8, z: 999 },
  ]);
  assert.strictEqual(restored[2], tasks[2]);
});

test('create-group cancellation leaves ordinary and multi-selected tasks unchanged', () => {
  const tasks = [
    { id: 1, desktopCanvasX: 10, desktopCanvasY: 20 },
    { id: 2, desktopCanvasX: 50, desktopCanvasY: 60 },
  ];
  const restored = restoreCancelledPackMerge(tasks, {
    mode: 'create-group',
    movingTaskIds: [1, 2],
    fallbackPosition: { x: 300, y: 400 },
  }, 999);

  assert.strictEqual(restored, tasks);
  assert.deepEqual(restored.map(({ desktopCanvasX, desktopCanvasY }) => [desktopCanvasX, desktopCanvasY]), [
    [10, 20],
    [50, 60],
  ]);
});
