import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderCount } from '../../app1-backend/src/services/statsService';

// Fails against the buggy service (throws for "carol"); passes once healed.
test('getOrderCount returns 0 for a user with no orders', () => {
  assert.equal(getOrderCount('carol'), 0);
});

test('getOrderCount counts a user with orders', () => {
  assert.equal(getOrderCount('alice'), 2);
});
