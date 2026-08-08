import test from 'node:test';
import assert from 'node:assert/strict';
import { getPackDisplayName, resolvePackMetadata } from '../model/packSelectors.js';

test('getPackDisplayName: uses desktopGroupName when present', () => {
  const tasks = [
    { id: 1, desktopGroupName: '  Target Group B  ', text: 'Task 1' },
    { id: 2, text: 'Task 2' },
  ];
  assert.equal(getPackDisplayName(tasks), 'Target Group B');
});

test('getPackDisplayName: falls back to first text', () => {
  const tasks = [
    { id: 1, desktopGroupName: null, text: 'First Task Text' },
  ];
  assert.equal(getPackDisplayName(tasks), 'First Task Text');
});

test('resolvePackMetadata: resolves complete metadata across all target tasks', () => {
  const targetTasks = [
    {
      id: 10,
      desktopGroupName: 'Group B Title',
      desktopGroupIcon: null, // First item has no icon
      desktopGroupCover: null,
      desktopGroupTags: ['tag1'],
      dateString: '2026-08-10',
    },
    {
      id: 11,
      desktopGroupName: 'Group B Title',
      desktopGroupIcon: 'icon-star', // Second item HAS the icon
      desktopGroupCover: 'cover.jpg',
      desktopGroupTags: ['tag1', 'tag2'],
      desktopGroupActiveDurationType: 'week',
      desktopGroupActiveFrom: '2026-08-01',
      desktopGroupActiveUntil: '2026-08-07',
      dateString: '2026-08-10',
    },
  ];

  const meta = resolvePackMetadata(targetTasks);

  assert.equal(meta.desktopGroupName, 'Group B Title');
  assert.equal(meta.desktopGroupIcon, 'icon-star'); // Successfully found icon from 2nd task!
  assert.equal(meta.desktopGroupCover, 'cover.jpg');
  assert.deepEqual(meta.desktopGroupTags, ['tag1']);
  assert.equal(meta.desktopGroupActiveDurationType, 'week');
  assert.equal(meta.desktopGroupActiveFrom, '2026-08-01');
  assert.equal(meta.desktopGroupActiveUntil, '2026-08-07');
  assert.equal(meta.dateString, '2026-08-10');
});

test('resolvePackMetadata: empty array returns safe defaults', () => {
  const meta = resolvePackMetadata([]);
  assert.equal(meta.desktopGroupName, 'Untitled group');
  assert.equal(meta.desktopGroupIcon, null);
  assert.equal(meta.desktopGroupCover, null);
  assert.deepEqual(meta.desktopGroupTags, []);
  assert.equal(meta.dateString, null);
});
