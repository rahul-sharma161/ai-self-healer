import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { config } from '../config/index';

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

function buildUserPrompt(source: string, message: string, stack: string, line: number): string {
  return [
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
  ].join('\n');
}

/** Ask Claude for the minimal corrected full-file contents that fix the error. */
export async function generateFix(
  absPath: string,
  error: { message: string; stack: string },
  line: number,
): Promise<Fix> {
  const source = await readFile(absPath, 'utf8');
  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: FIX_SCHEMA } },
      messages: [{ role: 'user', content: buildUserPrompt(source, error.message, error.stack, line) }],
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
