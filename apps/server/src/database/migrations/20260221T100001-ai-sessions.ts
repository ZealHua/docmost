import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_sessions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    // page_id is nullable — session can be workspace-scoped (no specific page)
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'))
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull())
    .addColumn('title', 'varchar') // first user message truncated to 80 chars
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('ai_sessions_workspace_user_idx')
    .on('ai_sessions')
    .columns(['workspace_id', 'user_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ai_sessions').execute();
}
