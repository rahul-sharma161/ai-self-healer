type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [app2] ${level.toUpperCase()} ${message}${suffix}`;
  (level === 'error' ? console.error : console.log)(line);
}

/** Small structured logger so the assistant's output is consistent and greppable. */
export const log = {
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
