import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCloudWorkspace,
  loadCloudWorkspaces,
  shouldAutoMigrateLegacyWorkspaces,
  updateCloudWorkspace,
} from '../data/workspaceRepository.js';

test('migrates legacy local workspaces exactly once when cloud is empty', () => {
  assert.equal(shouldAutoMigrateLegacyWorkspaces({
    cloudWorkspaces: [],
    localWorkspaces: [{ id: 'legacy', name: 'Legacy' }],
    migrationCompleted: false,
  }), true);
});

test('does not restore local workspaces after migration has completed', () => {
  assert.equal(shouldAutoMigrateLegacyWorkspaces({
    cloudWorkspaces: [],
    localWorkspaces: [{ id: 'legacy', name: 'Legacy' }],
    migrationCompleted: true,
  }), false);
});

test('signed-in Workspace operations fail closed when Supabase is unavailable', async (t) => {
  const { supabase } = await import('../../../supabase.js');
  if (supabase) {
    t.skip('Supabase is configured in this test environment.');
    return;
  }

  await assert.rejects(
    createCloudWorkspace('user-1', { id: 'unpersisted', name: 'Unpersisted' }),
    /Supabase is not configured/,
  );
  await assert.rejects(loadCloudWorkspaces('user-1'), /Supabase is not configured/);
  await assert.rejects(
    updateCloudWorkspace('user-1', { id: 'workspace-1', name: 'Changed' }),
    /Supabase is not configured/,
  );
});
