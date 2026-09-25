import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldAutoMigrateLegacyWorkspaces } from '../data/workspaceRepository.js';

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
