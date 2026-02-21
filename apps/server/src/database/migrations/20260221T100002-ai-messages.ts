import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_messages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('session_id', 'uuid', (col) =>
      col.references('ai_sessions.id').onDelete('cascade').notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    .addColumn('role', 'varchar', (col) => col.notNull()) // 'user' | 'assistant'
    .addColumn('content', 'text', (col) => col.notNull())
    // sources: JSONB — stores citation metadata alongside each assistant message.
    // Shape: Array<{ pageId, title, slugId, spaceSlug, excerpt, similarity }>
    // Self-contained history — no joins needed to render citations from old messages.
    .addColumn('sources', 'jsonb', (col) => col.defaultTo('[]'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('ai_messages_session_id_idx')
    .on('ai_messages')
    .column('session_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ai_messages').execute();
}
