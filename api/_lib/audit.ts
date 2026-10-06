import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

let tableReady = false;

export async function recordAudit(
  sql: Sql,
  entry: { action: string; listingId: string; userId: string; userEmail: string },
): Promise<void> {
  try {
    if (!tableReady) {
      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGSERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          listing_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_email TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      tableReady = true;
    }
    await sql`
      INSERT INTO audit_log (action, listing_id, user_id, user_email)
      VALUES (${entry.action}, ${entry.listingId}, ${entry.userId}, ${entry.userEmail})
    `;
  } catch (error) {
    console.error('[audit] failed to record', error);
  }
}
