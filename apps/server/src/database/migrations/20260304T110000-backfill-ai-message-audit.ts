import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE ai_messages AS am
    SET audit = jsonb_build_object(
      'approval',
      jsonb_build_object(
        'approvedAt', rs.approved_at,
        'approvedById', rs.approved_by_id,
        'approvedPlanHash', rs.approved_plan_hash
      )
    )
    FROM research_sessions AS rs
    WHERE am.audit IS NULL
      AND am.role = 'assistant'
      AND rs.session_id IS NOT NULL
      AND am.session_id = rs.session_id
      AND rs.approved_at IS NOT NULL
      AND rs.approved_plan_hash IS NOT NULL
      AND am.created_at >= rs.approved_at
      AND (
        rs.completed_at IS NULL
        OR am.created_at <= rs.completed_at + interval '5 minutes'
      )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE ai_messages AS am
    SET audit = NULL
    FROM research_sessions AS rs
    WHERE am.audit IS NOT NULL
      AND am.role = 'assistant'
      AND rs.session_id IS NOT NULL
      AND am.session_id = rs.session_id
      AND rs.approved_plan_hash IS NOT NULL
      AND (am.audit -> 'approval' ->> 'approvedPlanHash') = rs.approved_plan_hash
  `.execute(db)
}
