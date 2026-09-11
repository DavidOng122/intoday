import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserScopedStorageKey } from '../shared/storage/userScopedStorage.js';

test('getUserScopedStorageKey keeps guest data separate from authenticated users', () => {
  assert.equal(getUserScopedStorageKey('todos', null), 'todos');
  assert.equal(getUserScopedStorageKey('todos', 'user-1'), 'todos:user-1');
  assert.equal(getUserScopedStorageKey('todos', 'auth/user 1'), 'todos:auth%2Fuser%201');
});
