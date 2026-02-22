import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { RagChunk } from '../interfaces/ai-provider.interface';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers/helpers';

@Injectable()
export class RagService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly orchestrator: AiOrchestratorService,
  ) {}

  /**
   * Retrieves the top-K most semantically similar page chunks for a query.
   * Scoped to workspaceId (workspace-wide search).
   * Returns empty array if pgvector table does not exist.
   */
  async retrieve(
    query: string,
    workspaceId: string,
    topK = 5,
  ): Promise<RagChunk[]> {
    if (!(await isPageEmbeddingsTableExists(this.db))) return [];

    const [queryEmbedding] = await this.orchestrator
      .getProvider()
      .generateEmbeddings([query]);

    // pgvector cosine similarity: 1 - (a <=> b)
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const rows = await sql<{
      pageId: string;
      title: string;
      slugId: string;
      spaceSlug: string;
      excerpt: string;
      similarity: number;
      chunkIndex: number;
    }>`
      SELECT
        pe.page_id       AS "pageId",
        p.title,
        p.slug_id        AS "slugId",
        s.slug           AS "spaceSlug",
        (pe.metadata->>'excerpt')::text AS excerpt,
        1 - (pe.embedding <=> ${sql.raw(`'${vectorLiteral}'::vector`)}::vector) AS similarity,
        pe.chunk_index   AS "chunkIndex"
      FROM page_embeddings pe
      INNER JOIN pages p  ON p.id = pe.page_id
      INNER JOIN spaces s ON s.id = pe.space_id
      WHERE pe.workspace_id = ${workspaceId}
        AND p.deleted_at IS NULL
      ORDER BY similarity DESC
      LIMIT ${topK}
    `.execute(this.db);

    return rows.rows.map((row: any) => ({
      ...row,
      excerpt: (row.excerpt && row.excerpt !== 'null') ? row.excerpt : '',
    }));
  }

  /**
   * Retrieves full page content for selected pages.
   * Returns chunks with the full page content as the excerpt.
   */
  async retrieveSelectedPages(
    pageIds: string[],
    workspaceId: string,
  ): Promise<RagChunk[]> {
    if (pageIds.length === 0) return [];

    const rows = await this.db
      .selectFrom('pages')
      .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select([
        'pages.id as pageId',
        'pages.title',
        'pages.slugId',
        'spaces.slug as spaceSlug',
        'pages.textContent as textContent',
        'pages.content as content',
      ])
      .where('pages.id', 'in', pageIds)
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.deletedAt', 'is', null)
      .execute();

    return rows.map((row: any, index: number) => ({
      pageId: row.pageId,
      title: row.title,
      slugId: row.slugId,
      spaceSlug: row.spaceSlug,
      excerpt: (row.textContent && row.textContent !== 'null') ? row.textContent : '',
      similarity: 1,
      chunkIndex: index,
    }));
  }
}
