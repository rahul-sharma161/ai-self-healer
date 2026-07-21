import chokidar from 'chokidar';
import { mkdir, open, stat } from 'node:fs/promises';
import path from 'node:path';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  stack: string;
}

/** Watch the log file and emit each new `error`-level JSON line, reading only appended bytes. */
export function watchLog(logPath: string, onError: (entry: LogEntry) => void): void {
  let offset = 0;
  let running = false;
  let pending = false;

  const readNew = async (): Promise<void> => {
    if (running) {
      pending = true; // a change arrived mid-read; run once more after this
      return;
    }
    running = true;
    try {
      let size: number;
      try {
        size = (await stat(logPath)).size;
      } catch {
        return; // file not present yet
      }
      if (size < offset) offset = 0; // file truncated/rotated
      if (size === offset) return;

      const fh = await open(logPath, 'r');
      try {
        const len = size - offset;
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, offset);
        offset = size;
        for (const line of buf.toString('utf8').split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const entry = JSON.parse(trimmed) as LogEntry;
            if (entry.level === 'error') onError(entry);
          } catch {
            // partial or malformed line; skip
          }
        }
      } finally {
        await fh.close();
      }
    } finally {
      running = false;
      if (pending) {
        pending = false;
        void readNew();
      }
    }
  };

  // chokidar (v5) does not reliably pick up a watched file that is created AFTER
  // the watch starts, so ensure it exists first — App2 may start before App1.
  void (async () => {
    await mkdir(path.dirname(logPath), { recursive: true });
    await (await open(logPath, 'a')).close(); // touch (create if missing)
    chokidar.watch(logPath, { ignoreInitial: false }).on('add', readNew).on('change', readNew);
  })();
}
