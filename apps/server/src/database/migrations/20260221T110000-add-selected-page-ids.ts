import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_sessions')
    .addColumn('selected_page_ids', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_sessions')
    .dropColumn('selected_page_ids')
    .execute();
}
