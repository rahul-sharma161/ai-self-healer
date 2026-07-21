import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analyze } from '../../app2-assistant/src/services/errorAnalyzer';

const srcRoot = path.resolve('app1-backend', 'src');

function entry(stack: string, message = 'boom') {
  return { timestamp: '', level: 'error', message, stack };
}

test('locates the first App1 source frame in the stack', () => {
  const stack = [
    'TypeError: boom',
    `    at fn (${srcRoot}/services/statsService.ts:9:25)`,
    '    at other (/somewhere/node_modules/x.ts:1:1)',
  ].join('\n');

  const located = analyze(entry(stack), srcRoot);
  assert.ok(located);
  assert.equal(located.absPath, path.join(srcRoot, 'services', 'statsService.ts'));
  assert.equal(located.line, 9);
});

test('returns null when no frame is inside App1 source', () => {
  const stack = 'TypeError: boom\n    at fn (/somewhere/node_modules/x.ts:1:1)';
  assert.equal(analyze(entry(stack), srcRoot), null);
});

test('produces a stable signature for the same error', () => {
  const stack = `TypeError: boom\n    at fn (${srcRoot}/services/statsService.ts:9:25)`;
  const a = analyze(entry(stack), srcRoot);
  const b = analyze(entry(stack), srcRoot);
  assert.equal(a?.signature, b?.signature);
});
