import test from 'node:test';
import assert from 'node:assert/strict';
import { drainConnectionOperations } from '../data/connectionSync.js';

test('connection operation drain executes mutations serially', async () => {
  const events = [];
  const result = await drainConnectionOperations([{ id: 1 }, { id: 2 }], async (operation) => {
    events.push(`start-${operation.id}`);
    await Promise.resolve();
    events.push(`end-${operation.id}`);
  });
  assert.deepEqual(events, ['start-1', 'end-1', 'start-2', 'end-2']);
  assert.deepEqual(result.remaining, []);
});

test('connection operation drain retains failed and later mutations for retry', async () => {
  const result = await drainConnectionOperations([{ id: 1 }, { id: 2 }, { id: 3 }], async (operation) => {
    if (operation.id === 2) throw new Error('offline');
  });
  assert.equal(result.completed, 1);
  assert.deepEqual(result.remaining.map((operation) => operation.id), [2, 3]);
  assert.equal(result.error.message, 'offline');

  const retried = await drainConnectionOperations(result.remaining, async () => undefined);
  assert.deepEqual(retried.remaining, []);
});
