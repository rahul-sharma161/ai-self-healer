import test from 'node:test';
import assert from 'node:assert/strict';
import { computeShare } from '../../app1-backend/src/services/mathService';

// Fails against the buggy service (throws when parts is 0); passes once healed.
test('computeShare returns 0 when parts is 0', () => {
  assert.equal(computeShare(1000n, 0n), 0n);
});

test('computeShare splits a total evenly', () => {
  assert.equal(computeShare(1000n, 4n), 250n);
});
