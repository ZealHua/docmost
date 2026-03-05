import { type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_messages')
    .addColumn('audit', 'jsonb')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_messages')
    .dropColumn('audit')
    .execute()
}
