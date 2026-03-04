import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create workspace_quotas table for tracking monthly usage limits
  await db.schema
    .createTable('workspace_quotas')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('research_requests_limit', 'integer', (col) => col.notNull().defaultTo(100))
    .addColumn('web_searches_limit', 'integer', (col) => col.notNull().defaultTo(500))
    .addColumn('crawl_urls_limit', 'integer', (col) => col.notNull().defaultTo(1000))
    .addColumn('llm_tokens_limit', 'integer', (col) => col.notNull().defaultTo(1000000))
    .addColumn('research_requests_used', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('web_searches_used', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('crawl_urls_used', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('llm_tokens_used', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('total_cost_this_month', sql`numeric(10,2)`, (col) => col.notNull().defaultTo(0.00))
    .addColumn('currency', 'varchar(3)', (col) => col.notNull().defaultTo('USD'))
    .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('last_reset_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addUniqueConstraint('workspace_quotas_workspace_id_unique', ['workspace_id'])
    .execute()

  // Create research_sessions table for tracking individual research sessions
  await db.schema
    .createTable('research_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('session_id', 'uuid', (col) => col.references('ai_sessions.id').onDelete('set null'))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('query', 'text', (col) => col.notNull())
    .addColumn('plan', 'jsonb')
    .addColumn('final_report', 'text')
    .addColumn('web_searches_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('crawl_urls_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('llm_input_tokens', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('llm_output_tokens', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('estimated_cost', sql`numeric(10,4)`, (col) => col.notNull().defaultTo(0.0000))
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('in_progress'))
    .addColumn('error_message', 'text')
    .addColumn('started_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('completed_at', 'timestamp')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute()

  await db.schema
    .createIndex('research_sessions_workspace_user_idx')
    .on('research_sessions')
    .columns(['workspace_id', 'user_id'])
    .execute()

  await db.schema
    .createIndex('research_sessions_started_at_idx')
    .on('research_sessions')
    .column('started_at')
    .execute()

  // Create research_operations table for audit trail
  await db.schema
    .createTable('research_operations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('research_session_id', 'uuid', (col) => col.notNull().references('research_sessions.id').onDelete('cascade'))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('operation_type', 'varchar(30)', (col) => col.notNull())
    .addColumn('operation_details', 'jsonb')
    .addColumn('cost_amount', sql`numeric(10,4)`, (col) => col.notNull())
    .addColumn('cost_currency', 'varchar(3)', (col) => col.notNull().defaultTo('USD'))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute()

  await db.schema
    .createIndex('research_operations_research_session_id_idx')
    .on('research_operations')
    .column('research_session_id')
    .execute()

  await db.schema
    .createIndex('research_operations_workspace_id_idx')
    .on('research_operations')
    .column('workspace_id')
    .execute()

  // Create default quota entries for existing workspaces
  await db
    .insertInto('workspace_quotas')
    .columns(['workspace_id', 'research_requests_limit', 'web_searches_limit', 'crawl_urls_limit', 'llm_tokens_limit'])
    .expression(
      db
        .selectFrom('workspaces')
        .select([
          'workspaces.id as workspace_id',
          sql`100`.as('research_requests_limit'),
          sql`500`.as('web_searches_limit'),
          sql`1000`.as('crawl_urls_limit'),
          sql`1000000`.as('llm_tokens_limit'),
        ])
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('research_operations').execute()
  await db.schema.dropTable('research_sessions').execute()
  await db.schema.dropTable('workspace_quotas').execute()
}
