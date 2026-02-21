import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';

@Injectable()
export class PageEmbeddingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertMany(
    embeddings: Array<{
      pageId: string;
      spaceId: string;
      workspaceId: string;
      modelName: string;
      modelDimensions: number;
      embedding: number[];
      chunkIndex: number;
      chunkStart: number;
      chunkLength: number;
      metadata: Record<string, any>;
    }>,
  ): Promise<void> {
    if (embeddings.length === 0) return;

    // pgvector requires the embedding as a string literal '[x,y,z,...]'
    const rows = embeddings.map((e) => ({
      pageId: e.pageId,
      spaceId: e.spaceId,
      workspaceId: e.workspaceId,
      modelName: e.modelName,
      modelDimensions: e.modelDimensions,
      attachmentId: '',
      // Cast to vector type using sql template
      embedding: sql`${`[${e.embedding.join(',')}]`}::vector`,
      chunkIndex: e.chunkIndex,
      chunkStart: e.chunkStart,
      chunkLength: e.chunkLength,
      metadata: JSON.stringify(e.metadata),
    }));

    await this.db
      .insertInto('pageEmbeddings')
      .values(rows as any)
      .execute();
  }

  async deleteByPageId(pageId: string): Promise<void> {
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('pageId', '=', pageId)
      .execute();
  }

  async deleteByPageIds(pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) return;
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('pageId', 'in', pageIds)
      .execute();
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
