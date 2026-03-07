import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('actor_type', 'text', (col) => col.notNull())
    .addColumn('actor_id', 'uuid')
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('resource_type', 'text', (col) => col.notNull())
    .addColumn('resource_id', 'text')
    .addColumn('ip_address', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('before', 'jsonb')
    .addColumn('after', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_workspace_created_at')
    .on('audit_logs')
    .columns(['workspace_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_workspace_event')
    .on('audit_logs')
    .columns(['workspace_id', 'event_type'])
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_workspace_resource')
    .on('audit_logs')
    .columns(['workspace_id', 'resource_type'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_logs').execute();
}
