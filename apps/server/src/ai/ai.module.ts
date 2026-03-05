import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { WebSearchService } from './services/web-search.service';
import { EmbeddingService } from './services/embedding.service';
import { RagService } from './services/rag.service';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AiQueueProcessor } from './processors/ai-queue.processor';
import { PageEmbeddingRepo } from './repos/page-embedding.repo';
import { AiSessionRepo } from './repos/ai-session.repo';
import { AiMessageRepo } from './repos/ai-message.repo';
import { QueueName } from '../integrations/queue/constants';
import { DeepResearchService } from './services/deep-research.service';
import { QuotaService } from './services/quota.service';
import { ClarificationService } from './services/clarification.service';
import { PlanningService } from './services/planning.service';
import { JinaCrawlerService } from './services/jina-crawler.service';
import { ContentExtractorService } from './services/content-extractor.service';
import { TavilyResearchService } from './services/tavily-research.service';
import { QuotaRepo } from './repos/quota.repo';
import { ResearchSessionRepo } from './repos/research-session.repo';

@Module({
  imports: [
    // AiQueueProcessor is decorated with @Processor(QueueName.AI_QUEUE).
    // BullMQ requires the queue to be registered in the same module context as
    // the processor — this import makes AiModule self-contained.
    BullModule.registerQueue({ name: QueueName.AI_QUEUE }),
  ],
  controllers: [AiController],
  providers: [
    // Orchestrator + providers
    AiOrchestratorService,
    OpenAiProvider,
    GeminiProvider,
    OllamaProvider,
    // Services
    EmbeddingService,
    RagService,
    WebSearchService,
    // Deep research services
    DeepResearchService,
    QuotaService,
    ClarificationService,
    PlanningService,
    JinaCrawlerService,
    ContentExtractorService,
    TavilyResearchService,
    // Repos
    PageEmbeddingRepo,
    AiSessionRepo,
    AiMessageRepo,
    QuotaRepo,
    ResearchSessionRepo,
    // Queue processor — registers itself with BullMQ.AI_QUEUE
    AiQueueProcessor,
  ],
  exports: [
    AiOrchestratorService,
    EmbeddingService,
    RagService,
    AiSessionRepo,
    AiMessageRepo,
    WebSearchService,
    DeepResearchService,
    QuotaService,
  ],
})
export class AiModule {}
