import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // app2-assistant/src/config
const repoRoot = path.resolve(here, '../../..');           // repo root

export interface Config {
  apiKey: string;
  model: string;
  maxAttempts: number;
  repoRoot: string;
  logPath: string;
  app1SrcRoot: string;
  /** GitHub PR creation is enabled only when githubToken is set (optional feature). */
  githubToken: string;
  githubRepo: string; // "owner/name"
  baseBranch: string; // PR base branch
}

export const config: Config = {
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  maxAttempts: Number(process.env.MAX_HEAL_ATTEMPTS ?? '2'), // heal tries per unique error
  repoRoot,
  logPath: path.join(repoRoot, 'logs', 'app.log'),
  app1SrcRoot: path.join(repoRoot, 'app1-backend', 'src'),
  githubToken: process.env.GITHUB_TOKEN ?? '',
  githubRepo: process.env.GITHUB_REPO ?? '',
  baseBranch: process.env.GIT_BASE_BRANCH ?? 'main',
};

if (!config.apiKey) {
  console.error('[app2] ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}
