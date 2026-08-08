import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGroupHandleCoordinates,
  createDesktopConnection,
} from '../model/canvasConnections.js';

test('getGroupHandleCoordinates calculates left and right handle points', () => {
  const mockGroupEntry = {
    type: 'group',
    id: 'group-1',
    x: 100,
    y: 200,
    tasks: [{ id: '1' }, { id: '2' }],
  };

  const leftHandle = getGroupHandleCoordinates(mockGroupEntry, 'left');
  assert.equal(leftHandle.x, 100);

  const rightHandle = getGroupHandleCoordinates(mockGroupEntry, 'right');
  assert.equal(rightHandle.x, 436); // 100 + 336
});

test('createDesktopConnection generates a valid connection object', () => {
  const conn = createDesktopConnection({
    sourceGroupId: 'group-1',
    sourceSide: 'right',
    targetGroupId: 'group-2',
    targetSide: 'left',
    dateKey: '2026-08-08',
  });

  assert.ok(conn.id.startsWith('connection-'));
  assert.equal(conn.sourceGroupId, 'group-1');
  assert.equal(conn.sourceSide, 'right');
  assert.equal(conn.targetGroupId, 'group-2');
  assert.equal(conn.targetSide, 'left');
  assert.equal(conn.dateKey, '2026-08-08');
});
