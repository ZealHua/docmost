import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_sessions')
    .addColumn('thread_id', 'varchar')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('ai_sessions')
    .dropColumn('thread_id')
    .execute();
}
