import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { writeSource } from '../../app2-assistant/src/services/patchService';

test('writeSource refuses paths outside the source root', async () => {
  await assert.rejects(() => writeSource('/etc/passwd', 'x', '/safe/root'));
});

test('writeSource writes atomically inside the source root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'heal-'));
  const file = path.join(root, 'target.ts');
  await writeFile(file, 'old');

  await writeSource(file, 'new', root);
  assert.equal(await readFile(file, 'utf8'), 'new');

  await rm(root, { recursive: true, force: true });
});
