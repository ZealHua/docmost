import { type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('research_sessions')
    .addColumn('approved_at', 'timestamp')
    .addColumn('approved_by_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('approved_plan_hash', 'varchar(64)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('research_sessions')
    .dropColumn('approved_plan_hash')
    .dropColumn('approved_by_id')
    .dropColumn('approved_at')
    .execute()
}
