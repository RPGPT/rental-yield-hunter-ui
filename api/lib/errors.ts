import type { VercelResponse } from '../_types';

function extractMessage(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const e = error as Error & { code?: string };
    return { message: e.message, ...(e.code ? { code: e.code } : {}) };
  }
  return { message: String(error) };
}

export function sendError(res: VercelResponse, error: unknown, status = 500): VercelResponse {
  const { message, code } = extractMessage(error);
  console.error('[sendError]', { message, code });
  return res.status(status).json({ error: { message, ...(code ? { code } : {}), status } });
}
