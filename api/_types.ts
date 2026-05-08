import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
  body: unknown;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  send(body: unknown): VercelResponse;
}
