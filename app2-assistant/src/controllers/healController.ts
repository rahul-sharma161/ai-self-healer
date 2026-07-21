import { readFile } from 'node:fs/promises';
import { analyze } from '../services/errorAnalyzer';
import { generateFix } from '../services/aiService';
import { writeSource } from '../services/patchService';
import { verifyFix } from '../services/verifyService';
import { createFixPr } from '../services/gitService';
import { config } from '../config/index';
import { log } from '../utils/logger';
import type { LogEntry } from '../services/logWatcher';

const attemptsBySignature = new Map<string, number>();

// Heals run one at a time: verification spawns typecheck/test processes and
// rewrites source files, so overlapping heals would race. New errors queue here.
let queue: Promise<void> = Promise.resolve();

/** Entry point: enqueue a heal for a detected error. Never throws to the caller. */
export function handleError(entry: LogEntry): void {
  queue = queue
    .then(() => heal(entry))
    .catch((err) => log.error('heal crashed', { error: String(err) }));
}

async function heal(entry: LogEntry): Promise<void> {
  const located = analyze(entry, config.app1SrcRoot);
  if (!located) {
    log.info('error not traced to App1 source, skipping', { message: entry.message });
    return;
  }

  const attempts = attemptsBySignature.get(located.signature) ?? 0;
  if (attempts >= config.maxAttempts) return;
  attemptsBySignature.set(located.signature, attempts + 1);

  const source = `${located.absPath}:${located.line}`;
  log.info('error detected', { message: entry.message, source, attempt: attempts + 1 });

  const original = await readFile(located.absPath, 'utf8'); // backup for rollback
  try {
    const fix = await generateFix(located.absPath, entry, located.line);
    if (!fix.newContent.trim()) {
      throw new Error('AI returned empty file content');
    }

    await writeSource(located.absPath, fix.newContent, config.app1SrcRoot);
    const result = await verifyFix(located.absPath);

    if (result.ok) {
      log.info('fix verified and applied', { source, check: result.detail, explanation: fix.explanation });
      // PDF steps 6-7: commit + open a PR. Failure here must not revert the good fix.
      try {
        await createFixPr({
          absPath: located.absPath,
          newContent: fix.newContent,
          errorMessage: entry.message,
          stack: entry.stack,
          explanation: fix.explanation,
        });
      } catch (prErr) {
        log.error('PR creation failed; fix remains applied locally', { source, error: String(prErr) });
      }
    } else {
      await writeSource(located.absPath, original, config.app1SrcRoot); // roll back
      log.warn('fix rejected and reverted', { source, check: result.detail });
    }
  } catch (err) {
    await writeSource(located.absPath, original, config.app1SrcRoot).catch(() => undefined);
    log.error('heal failed', { source, error: String(err) });
  }
}
