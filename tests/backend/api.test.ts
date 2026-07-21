import test from 'node:test';
import assert from 'node:assert/strict';
import { countItems } from '../../app1-backend/src/services/apiService';

// Fails against the buggy service (throws for "broken"); passes once healed.
test('countItems returns 0 for a response with no data', () => {
  assert.equal(countItems('broken'), 0);
});

test('countItems counts items in a valid response', () => {
  assert.equal(countItems('ok'), 2);
});
