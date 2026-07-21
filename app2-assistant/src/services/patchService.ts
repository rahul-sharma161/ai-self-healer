import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write `content` to `absPath` atomically (temp file + rename), refusing any
 * path outside `srcRoot`. Used both to apply a fix and to roll one back.
 */
export async function writeSource(absPath: string, content: string, srcRoot: string): Promise<void> {
  if (!absPath.startsWith(srcRoot + path.sep)) {
    throw new Error(`Refusing to write outside App1 source root: ${absPath}`);
  }
  const tmp = `${absPath}.heal.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, absPath); // atomic replace so tsx never reads a half-written file
}
