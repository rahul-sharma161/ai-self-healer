import { createHash } from 'node:crypto';
import path from 'node:path';
import type { LogEntry } from './logWatcher';

export interface Located {
  absPath: string;
  line: number;
  signature: string;
}

/** Find the first stack frame inside App1's source and return its location + a dedupe signature. */
export function analyze(entry: LogEntry, app1SrcRoot: string): Located | null {
  const frames = entry.stack.split('\n');
  const frame = frames.find((f) => f.includes(app1SrcRoot));
  if (!frame) return null;

  // e.g.  at getOrderCount (/abs/app1-backend/src/services/statsService.ts:9:20)
  const match = frame.match(/([^\s()]+\.ts):(\d+):\d+/);
  if (!match) return null;

  const absPath = path.resolve(match[1]);
  if (!absPath.startsWith(app1SrcRoot + path.sep)) return null;

  const signature = createHash('sha1').update(`${entry.message}|${frame.trim()}`).digest('hex');
  return { absPath, line: Number(match[2]), signature };
}
