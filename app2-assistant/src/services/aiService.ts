import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { config } from '../config/index';
import { testFileFor } from './verifyService';

export interface Fix {
  /** The complete corrected contents of the file. */
  newContent: string;
  /** One-line explanation of the root cause and the change. */
  explanation: string;
}

const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 3 });

const SYSTEM_PROMPT = [
  'You are an automated code-repair assistant for a TypeScript project.',
  'You receive one source file and the runtime error it produced.',
  'Return the minimal corrected FULL contents of that file that fixes the root cause,',
  'preserving the public API, style, and all unrelated behavior. Do not add features,',
  'comments, or refactors beyond what the fix requires.',
  'When a test file is provided, your fix MUST make that test pass exactly as written:',
  'match its expected return values and behavior (e.g. return a safe default rather than',
  'throwing, if that is what the test asserts). Never modify the test.',
].join(' ');

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    newContent: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['newContent', 'explanation'],
  additionalProperties: false,
} as const;

function buildUserPrompt(
  source: string,
  message: string,
  stack: string,
  line: number,
  testSource: string | null,
): string {
  const parts = [
    `Runtime error: ${message}`,
    `Failing near line ${line}.`,
    '',
    'Stack trace:',
    stack,
    '',
    'File source:',
    '```typescript',
    source,
    '```',
  ];
  if (testSource) {
    parts.push(
      '',
      'The fix MUST make this test pass, exactly as written (do not modify it):',
      '```typescript',
      testSource,
      '```',
    );
  }
  return parts.join('\n');
}

/** Read the service's matching test, if one exists, to give the model the expected contract. */
async function readTestFor(absPath: string): Promise<string | null> {
  try {
    return await readFile(testFileFor(absPath), 'utf8');
  } catch {
    return null; // no matching test
  }
}

/** Ask Claude for the minimal corrected full-file contents that fix the error. */
export async function generateFix(
  absPath: string,
  error: { message: string; stack: string },
  line: number,
): Promise<Fix> {
  const source = await readFile(absPath, 'utf8');
  const testSource = await readTestFor(absPath);
  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: FIX_SCHEMA } },
      messages: [{ role: 'user', content: buildUserPrompt(source, error.message, error.stack, line, testSource) }],
    });
    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    return JSON.parse(textBlock?.text ?? '{}') as Fix;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Claude API error (${err.status ?? 'unknown'}): ${err.message}`);
    }
    throw err;
  }
}
