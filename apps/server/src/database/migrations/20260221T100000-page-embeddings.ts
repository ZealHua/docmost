import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable pgvector extension (idempotent)
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('page_embeddings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull())
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    .addColumn('model_name', 'varchar', (col) => col.notNull())
    .addColumn('model_dimensions', 'integer', (col) => col.notNull())
    .addColumn('attachment_id', 'varchar', (col) =>
      col.notNull().defaultTo(''))
    // vector(1024) matches AI_EMBEDDING_DIMENSION=1024 (ZhipuAI embedding-3).
    // If you switch providers with a different dimension, write a new migration:
    //   ALTER TABLE page_embeddings ALTER COLUMN embedding TYPE vector(N)
    //   and clear all existing embeddings (they are incompatible).
    .addColumn('embedding', sql`vector(1024)`, (col) => col.notNull())
    .addColumn('chunk_index', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('chunk_start', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('chunk_length', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  // HNSW index — best for ANN cosine similarity at query time
  await sql`
    CREATE INDEX page_embeddings_embedding_idx
    ON page_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `.execute(db);

  // Standard B-tree indexes for filtering
  await db.schema
    .createIndex('page_embeddings_workspace_id_idx')
    .on('page_embeddings')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('page_embeddings_page_id_idx')
    .on('page_embeddings')
    .column('page_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_embeddings').execute();
  // Note: do NOT drop the vector extension — other tables may use it
}
