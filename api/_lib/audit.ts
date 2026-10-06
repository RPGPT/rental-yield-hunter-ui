import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

export async function recordAudit(
  sql: Sql,
  entry: { action: string; listingId: string; userId: string; userEmail: string },
): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_log (action, listing_id, user_id, user_email)
      VALUES (${entry.action}, ${entry.listingId}, ${entry.userId}, ${entry.userEmail})
    `;
  } catch (error) {
    console.error('[audit] failed to record', error);
  }
}
