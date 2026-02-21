import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { EmbeddingService } from '../services/embedding.service';
import { PageEmbeddingRepo } from '../repos/page-embedding.repo';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers/helpers';
import { AiOrchestratorService } from '../services/ai-orchestrator.service';

@Processor(QueueName.AI_QUEUE)
@Injectable()
export class AiQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(AiQueueProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly embeddingService: EmbeddingService,
    private readonly embeddingRepo: PageEmbeddingRepo,
    private readonly orchestrator: AiOrchestratorService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // Guard: if AI is not configured or pgvector table absent, skip silently
    if (!this.orchestrator.isConfigured()) return;
    if (!(await isPageEmbeddingsTableExists(this.db))) return;

    switch (job.name) {
      // Page lifecycle — triggered by PageListener (already wired).
      // Payload: { pageIds: string[], workspaceId: string }
      case QueueJob.PAGE_CREATED:
      case QueueJob.PAGE_RESTORED: {
        const { pageIds, workspaceId } = job.data;
        for (const pageId of pageIds) {
          await this.embeddingService.embedPage(pageId, workspaceId);
        }
        break;
      }

      // Content update — triggered by collab persistence layer (already wired).
      // Payload: { pageId: string, workspaceId: string }
      case QueueJob.PAGE_CONTENT_UPDATED: {
        const { pageId, workspaceId } = job.data;
        await this.embeddingService.embedPage(pageId, workspaceId);
        break;
      }

      // Soft delete / hard delete.
      // Payload: { pageIds: string[], workspaceId: string }
      case QueueJob.PAGE_SOFT_DELETED:
      case QueueJob.PAGE_DELETED: {
        const { pageIds } = job.data;
        await this.embeddingRepo.deleteByPageIds(pageIds);
        break;
      }

      // Per-page explicit embed/delete
      case QueueJob.GENERATE_PAGE_EMBEDDINGS: {
        const { pageId, workspaceId } = job.data;
        await this.embeddingService.embedPage(pageId, workspaceId);
        break;
      }

      case QueueJob.DELETE_PAGE_EMBEDDINGS: {
        const { pageIds } = job.data;
        await this.embeddingRepo.deleteByPageIds(pageIds);
        break;
      }

      // Workspace-level bulk operations
      case QueueJob.WORKSPACE_CREATE_EMBEDDINGS: {
        const { workspaceId } = job.data;
        await this.embeddingService.embedWorkspace(workspaceId);
        break;
      }

      case QueueJob.WORKSPACE_DELETE_EMBEDDINGS: {
        const { workspaceId } = job.data;
        await this.embeddingRepo.deleteByWorkspaceId(workspaceId);
        break;
      }

      default:
        this.logger.warn(`Unknown AI queue job: ${job.name}`);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing AI job: ${job.name} [${job.id}]`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job, error: Error) {
    this.logger.error(
      `AI job failed: ${job.name} [${job.id}] — ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`AI job completed: ${job.name} [${job.id}]`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
