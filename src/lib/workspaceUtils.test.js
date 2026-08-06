import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDesktopWorkspaces,
  taskBelongsToWorkspace,
} from './workspaceUtils.js';

test('normalizeDesktopWorkspaces limits active workspaces to three', () => {
  const workspaces = normalizeDesktopWorkspaces([
    { id: 'one', name: 'One' },
    { id: 'two', name: 'Two' },
    { id: 'three', name: 'Three' },
    { id: 'four', name: 'Four' },
  ]);
  assert.equal(workspaces.length, 3);
  assert.deepEqual(workspaces.map((workspace) => workspace.id), ['one', 'two', 'three']);
});

test('taskBelongsToWorkspace hides soft-deleted workspace items', () => {
  assert.equal(taskBelongsToWorkspace({ desktopWorkspaceId: 'one' }, 'one'), true);
  assert.equal(taskBelongsToWorkspace({
    desktopWorkspaceId: 'one',
    desktopWorkspaceDeletedAt: '2026-08-06T00:00:00.000Z',
  }, 'one'), false);
});
