# AI-Powered Self-Healing Developer Assistant (local POC)

Two apps. **App1** is a small buggy backend that logs runtime errors. **App2** watches those
logs and, on each error, uses **Anthropic Claude** to generate a code fix, verifies it, applies it
back to App1's source, and — when a GitHub token is configured — commits it to a branch and opens
a pull request (PDF steps 1-7).

**GitHub PR is optional.** With no `GITHUB_TOKEN` the assistant stops after applying the verified
fix locally (no commit, no push, no PR). Provide a token + repo and it also raises the PR.

## Project structure

```
ai-self-healer/
  app1-backend/src/                 # App1 — buggy Express backend (MVC)
    models/userStore.ts             # in-memory data; "carol" is missing `orders`
    services/statsService.ts        # order count (fix target)
    services/apiService.ts          # upstream API item count (fix target)
    services/mathService.ts         # BigInt share split (fix target)
    controllers/backendController.ts# request handlers; catch + log errors
    routes/index.ts                 # express routes: /orders /items /share
    driver.ts                       # self-driver: hits the endpoints every 3s
    utils/logger.ts                 # appends JSON-line errors to logs/app.log
    index.ts                        # express bootstrap
  app2-assistant/src/               # App2 — self-healing assistant
    config/index.ts                 # env config (key, model, paths)
    services/logWatcher.ts          # tails logs/app.log (offset-tracked)
    services/errorAnalyzer.ts       # locates the App1 source file from the stack
    services/aiService.ts           # Claude -> { newContent, explanation }
    services/patchService.ts        # guarded atomic write
    services/verifyService.ts       # typecheck + matching test before accepting a fix
    services/gitService.ts          # optional: branch, commit, push, open GitHub PR
    controllers/healController.ts   # orchestrates detect -> fix -> verify -> apply -> PR
    index.ts                        # entrypoint
  tests/services.test.ts            # unit tests — fail on the bugs, pass after healing
  logs/app.log                      # shared error sink (gitignored)
```

## How it works

```
App1's self-driver calls its own endpoints; the failing ones throw runtime exceptions
   -> the controller catches them and logs each stack trace to logs/app.log
App2 watches logs/app.log -> detects each error -> parses the stack for the App1 source frame
   -> sends the file + error to Claude -> gets corrected file contents
   -> verifies (typecheck + matching test); on pass, writes them back into app1-backend/src
   -> if GITHUB_TOKEN + GITHUB_REPO set: branch + commit + push + open a GitHub PR
```

The healer is bug-agnostic: it keys off the stack trace and the source file, not any
specific error type — so each of the seeded bugs below is detected and fixed the same way.

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env      # then edit .env and set ANTHROPIC_API_KEY
```

`.env`:

```
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-opus-4-8   # optional; override e.g. claude-sonnet-5

# Optional — enable GitHub PR creation. Omit GITHUB_TOKEN to skip it entirely.
GITHUB_TOKEN=ghp_...              # repo-scoped token (contents + pull_requests write)
GITHUB_REPO=owner/name           # the repo to open the PR against
GIT_BASE_BRANCH=main             # PR base branch
```

The repo does not need to exist yet — create it later, push `main`, then set the vars.
When they are unset, everything else works unchanged and PR creation is silently skipped.

## Run the demo (two terminals)

```bash
# Terminal 1 — the buggy backend (auto-restarts on file change)
npm run app1

# Terminal 2 — the self-healing assistant
npm run app2
```

**What you'll see**: within ~10s the driver logs three `500`s — one per failing endpoint —
and App1 writes their stack traces to the log. App2 detects each, prints the located source
file, requests a fix from Claude, and writes the corrected file. `tsx watch` restarts App1, and
the same endpoints then return `200` with real values.

## Seeded bugs

Covering the PDF's example categories:

| Where | Bug | Surfaces as |
| --- | --- | --- |
| `statsService.ts` (`GET /orders?user=carol`) | reads `profile.orders.length`; user has no `orders` | `TypeError` — null/undefined |
| `apiService.ts` (`GET /items?key=broken`) | reads `res.data.items` on a response missing `data` | `TypeError` — invalid API response |
| `mathService.ts` (`GET /share?...&parts=0`) | BigInt division by `0n` | `RangeError` — divide-by-zero |
| `tests/services.test.ts` | asserts the correct edge-case behavior | **failing unit tests** (`npm test`) |

The endpoints and the tests exercise the *same* three service bugs. Run `npm test` before
healing → 3 failures; after App2 heals the services → `npm test` passes.

## Assumptions & known limits

- **PR is optional**: no `GITHUB_TOKEN` → no commit/push/PR (fix stays local). The PR branch is
  created off the current branch; after the PR the assistant returns to it with the fix still applied.
- **Write scope**: App2 only writes inside `app1-backend/src/`; any other path is rejected. The
  token-authed push URL is passed inline and never persisted to `.git/config` or logged.
- **Fix retry cap**: each unique error is retried up to `MAX_HEAL_ATTEMPTS` (default 2); a fix that
  fails verification is rolled back, not applied.
- **Pre-apply verification**: a fix is accepted only if the project still type-checks and the
  healed service's matching test passes; otherwise it is reverted.
