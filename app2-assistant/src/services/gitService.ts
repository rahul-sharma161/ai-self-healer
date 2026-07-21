import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from '../config/index';
import { log } from '../utils/logger';
import { writeSource } from './patchService';

const run = promisify(execFile);

async function git(args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: config.repoRoot });
  return stdout.trim();
}

export interface PrParams {
  absPath: string;
  newContent: string;
  errorMessage: string;
  stack: string;
  explanation: string;
}

/** True when GitHub PR creation is configured (a token is present). */
export function isPrConfigured(): boolean {
  return Boolean(config.githubToken);
}

/**
 * Commit the healed file to a new branch, push it, and open a GitHub pull request
 * (PDF steps 6-7). No-op unless BOTH a GitHub token and repo are configured — no
 * token means no commit, no push, no PR. Always returns to the original branch
 * with the fix still applied locally, and returns the PR URL (or null if skipped).
 */
export async function createFixPr(params: PrParams): Promise<string | null> {
  if (!config.githubToken) {
    log.info('GITHUB_TOKEN not set; skipping commit + PR creation');
    return null;
  }
  if (!config.githubRepo) {
    log.warn('GITHUB_TOKEN set but GITHUB_REPO not set; skipping PR creation');
    return null;
  }

  const relPath = path.relative(config.repoRoot, params.absPath);
  const service = path.basename(params.absPath).replace(/\.ts$/, '');
  const shortSig = createHash('sha1').update(`${params.errorMessage}|${relPath}`).digest('hex').slice(0, 8);
  const branch = `heal/${service}-${shortSig}`;

  const original = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  try {
    await git(['checkout', '-b', branch]);
    await git([
      'commit',
      '-m', `fix: heal ${relPath}`,
      '-m', `${params.explanation}\n\nError: ${params.errorMessage}\n\nAutomated fix by the AI Self-Healing Assistant.`,
      '--', relPath,
    ]);
    await pushBranch(branch);
    const url = await openPullRequest(branch, relPath, params);
    log.info('pull request created', { url, branch });
    return url;
  } finally {
    // Return to the original branch and re-apply the fix so App1 stays healed locally.
    await git(['checkout', original]).catch(() => undefined);
    await writeSource(params.absPath, params.newContent, config.app1SrcRoot).catch(() => undefined);
  }
}

async function pushBranch(branch: string): Promise<void> {
  // Token-authed URL passed inline so it is never persisted in .git/config. Never logged.
  const url = `https://x-access-token:${config.githubToken}@github.com/${config.githubRepo}.git`;
  await run('git', ['push', url, `${branch}:${branch}`], { cwd: config.repoRoot });
}

async function openPullRequest(head: string, relPath: string, params: PrParams): Promise<string> {
  const body = [
    'Automated fix by the AI Self-Healing Assistant.',
    '',
    `**File:** \`${relPath}\``,
    `**Error:** ${params.errorMessage}`,
    '',
    `**Explanation:** ${params.explanation}`,
    '',
    '<details><summary>Stack trace</summary>',
    '',
    '```',
    params.stack,
    '```',
    '</details>',
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${config.githubRepo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: `fix: heal ${relPath}`, head, base: config.baseBranch, body }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { html_url: string };
  return json.html_url;
}
