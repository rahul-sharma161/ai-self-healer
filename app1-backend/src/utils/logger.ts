import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // app1-backend/src/utils
const logDir = path.resolve(here, '../../../logs');        // <repo root>/logs
const logFile = path.join(logDir, 'app.log');

/** Append one JSON-line error record to the shared log that App2 watches. */
export async function logError(err: unknown): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: e.message,
    stack: e.stack ?? '',
  };
  await mkdir(logDir, { recursive: true });
  await appendFile(logFile, JSON.stringify(entry) + '\n', 'utf8');
}
