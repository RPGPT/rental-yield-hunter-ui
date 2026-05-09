import type { VercelResponse } from '../_types';

interface ApiError {
  message: string;
  code?: string;
}

/** Extracts a human-readable message from an unknown thrown value. */
function extractMessage(error: unknown): ApiError {
  if (error instanceof Error) {
    const neonError = error as Error & { code?: string; severity?: string };
    return {
      message: error.message,
      ...(neonError.code ? { code: neonError.code } : {}),
    };
  }
  return { message: String(error) };
}

/** Send a structured error response with the real error details.
 *  Uses 503 by default so the message is visible (not swallowed as a generic 500). */
export function sendError(res: VercelResponse, error: unknown, status = 503): VercelResponse {
  const { message, code } = extractMessage(error);
  console.error('[sendError]', { message, code });
  return res.status(status).json({
    error: {
      message,
      ...(code ? { code } : {}),
      status,
    },
  });
}
