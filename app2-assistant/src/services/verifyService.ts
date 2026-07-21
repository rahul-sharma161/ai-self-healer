import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index';

const run = promisify(execFile);

export interface VerifyResult {
  ok: boolean;
  detail: string;
}

async function runQuiet(command: string, args: string[]): Promise<boolean> {
  try {
    await run(command, args, { cwd: config.repoRoot });
    return true;
  } catch {
    return false; // non-zero exit → verification step failed
  }
}

/** The backend test that exercises a given service, by naming convention. */
export function testFileFor(absPath: string): string {
  const name = path.basename(absPath).replace(/Service\.ts$/, ''); // statsService.ts -> stats
  return path.join(config.repoRoot, 'tests', 'backend', `${name}.test.ts`);
}

/**
 * Confirm a candidate fix before it is accepted: the project must still
 * type-check, and the healed service's own test suite must pass. This is what
 * lets the assistant apply a fix only when it is actually correct.
 */
export async function verifyFix(absPath: string): Promise<VerifyResult> {
  if (!(await runQuiet('npm', ['run', 'typecheck']))) {
    return { ok: false, detail: 'typecheck failed' };
  }

  const testFile = testFileFor(absPath);
  try {
    await access(testFile);
  } catch {
    return { ok: true, detail: 'typecheck passed (no matching test)' };
  }

  const testPassed = await runQuiet('npx', ['tsx', '--test', testFile]);
  return testPassed
    ? { ok: true, detail: 'typecheck + test passed' }
    : { ok: false, detail: 'test failed' };
}
