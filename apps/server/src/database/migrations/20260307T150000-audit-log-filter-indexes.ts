import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('idx_audit_logs_workspace_actor_type_created_at')
    .on('audit_logs')
    .columns(['workspace_id', 'actor_type', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_workspace_actor_id_created_at')
    .on('audit_logs')
    .columns(['workspace_id', 'actor_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_audit_logs_workspace_actor_type_created_at')
    .execute();

  await db.schema
    .dropIndex('idx_audit_logs_workspace_actor_id_created_at')
    .execute();
}
