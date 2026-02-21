import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { PageEmbeddingRepo } from '../repos/page-embedding.repo';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers/helpers';

/**
 * Responsible for chunking page text and generating embeddings.
 * Called by AiQueueProcessor — never called directly by controllers.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  // Cache the table-exists check after first positive result to avoid
  // redundant DB round-trips on every job.
  private tableExistsCache = false;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly orchestrator: AiOrchestratorService,
    private readonly embeddingRepo: PageEmbeddingRepo,
  ) {}

  private async isTableReady(): Promise<boolean> {
    if (this.tableExistsCache) return true;
    const exists = await isPageEmbeddingsTableExists(this.db);
    if (exists) this.tableExistsCache = true;
    return exists;
  }

  async embedPage(pageId: string, workspaceId: string): Promise<void> {
    if (!(await this.isTableReady())) return;

    // Fetch page text content
    const page = await this.db
      .selectFrom('pages')
      .select(['id', 'title', 'textContent', 'spaceId'])
      .where('id', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!page || !page.textContent) {
      this.logger.debug(
        `Page ${pageId} has no text content, skipping embedding`,
      );
      return;
    }

    // Chunk the text (simple fixed-size chunking for Phase 1)
    const chunks = chunkText(page.textContent, 512, 64); // size=512, overlap=64

    // Delete existing embeddings for this page (re-embed on update)
    await this.embeddingRepo.deleteByPageId(pageId);

    // Generate embeddings in batches of 20 (rate limit friendly)
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await this.orchestrator
        .getProvider()
        .generateEmbeddings(batch.map((c) => c.text));

      await this.embeddingRepo.insertMany(
        batch.map((chunk, idx) => ({
          pageId,
          spaceId: page.spaceId,
          workspaceId,
          modelName: process.env.AI_EMBEDDING_MODEL ?? '',
          modelDimensions: embeddings[0].length,
          embedding: embeddings[idx],
          chunkIndex: i + idx,
          chunkStart: chunk.start,
          chunkLength: chunk.length,
          // Store both title AND excerpt in metadata.
          // excerpt is required by RagService.retrieve() which reads metadata->>'excerpt'.
          metadata: {
            title: page.title,
            excerpt: chunk.text.slice(0, 200),
          },
        })),
      );
    }

    this.logger.debug(`Embedded page ${pageId}: ${chunks.length} chunks`);
  }

  async embedWorkspace(workspaceId: string): Promise<void> {
    const pages = await this.db
      .selectFrom('pages')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();

    for (const page of pages) {
      await this.embedPage(page.id, workspaceId);
    }
  }
}

/**
 * Simple fixed-size chunking with word-boundary awareness.
 * Phase 1: character-based chunks. Phase 2: token-aware using tiktoken.
 *
 * Safety: overlap must be strictly less than chunkSize to avoid infinite loops.
 */
function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 64,
): Array<{ text: string; start: number; length: number }> {
  // Guard: ensure we always make forward progress
  const safeOverlap = Math.min(overlap, chunkSize - 1);
  const chunks: Array<{ text: string; start: number; length: number }> = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    // Extend to next word boundary to avoid mid-word splits
    const spaceIdx = text.indexOf(' ', end);
    const wordEnd = spaceIdx === -1 ? end : spaceIdx;
    const chunk = text.slice(start, wordEnd);
    chunks.push({ text: chunk, start, length: chunk.length });
    start += chunkSize - safeOverlap;
  }

  return chunks;
}
