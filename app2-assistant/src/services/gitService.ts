import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from '../config/index';
import { log } from '../utils/logger';

const run = promisify(execFile);

function git(args: string[], cwd: string = config.repoRoot): Promise<{ stdout: string }> {
  return run('git', args, { cwd });
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
 * Commit the healed file to a branch, push it, and open a GitHub pull request
 * (PDF steps 6-7). No-op unless BOTH a token and repo are configured.
 *
 * The commit is made in an isolated `git worktree` checked out at the base branch,
 * so the assistant's main working tree is never switched — every locally applied
 * heal is preserved. Each PR is a single-file diff against the base branch.
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

  const worktree = await mkdtemp(path.join(tmpdir(), 'heal-'));
  try {
    // Isolated worktree at base; -B (re)creates the heal branch idempotently.
    await git(['worktree', 'add', '-f', '-B', branch, worktree, config.baseBranch]);

    const target = path.join(worktree, relPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, params.newContent, 'utf8');

    await git(['add', '--', relPath], worktree);
    const who = await tokenIdentity();
    const authorArgs = who ? ['-c', `user.name=${who.name}`, '-c', `user.email=${who.email}`] : [];
    await git(
      [
        ...authorArgs,
        'commit',
        '-m', `fix: heal ${relPath}`,
        '-m', `${params.explanation}\n\nError: ${params.errorMessage}\n\nAutomated fix by the AI Self-Healing Assistant.`,
      ],
      worktree,
    );
    await pushBranch(branch, worktree);
    return await openPullRequest(branch, relPath, params);
  } finally {
    await git(['worktree', 'remove', '--force', worktree]).catch(() => undefined);
    await rm(worktree, { recursive: true, force: true }).catch(() => undefined);
  }
}

let identityCache: { name: string; email: string } | null = null;

/** Resolve the commit identity of the GitHub token owner (so heal commits are authored as that account). */
async function tokenIdentity(): Promise<{ name: string; email: string } | null> {
  if (identityCache) return identityCache;
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    log.warn('could not resolve token identity; using local git config', { status: res.status });
    return null;
  }
  const u = (await res.json()) as { login: string; id: number; name: string | null; email: string | null };
  identityCache = {
    name: u.name ?? u.login,
    email: u.email ?? `${u.id}+${u.login}@users.noreply.github.com`,
  };
  return identityCache;
}

async function pushBranch(branch: string, cwd: string): Promise<void> {
  // Token-authed URL passed inline so it is never persisted in .git/config. Never logged.
  const url = `https://x-access-token:${config.githubToken}@github.com/${config.githubRepo}.git`;
  await run('git', ['push', '--force', url, `${branch}:${branch}`], { cwd });
}

async function openPullRequest(head: string, relPath: string, params: PrParams): Promise<string | null> {
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

  if (res.status === 422) {
    // A PR for this head branch already exists (idempotent re-run) — the push above
    // updated it. Not an error.
    log.info('PR already open for branch; updated it', { branch: head });
    return null;
  }
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { html_url: string };
  log.info('pull request created', { url: json.html_url, branch: head });
  return json.html_url;
}
