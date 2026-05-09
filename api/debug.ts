import type { VercelRequest, VercelResponse } from './_types';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    DATABASE_URL: !!process.env['DATABASE_URL'],
    NEON_AUTH_URL: !!process.env['NEON_AUTH_URL'],
    NODE_ENV: process.env['NODE_ENV'],
    node: process.version,
  });
}
