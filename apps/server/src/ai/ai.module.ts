import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
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
    // Repos
    PageEmbeddingRepo,
    AiSessionRepo,
    AiMessageRepo,
    // Queue processor — registers itself with BullMQ.AI_QUEUE
    AiQueueProcessor,
  ],
  exports: [AiOrchestratorService, EmbeddingService, RagService, AiSessionRepo, AiMessageRepo],
})
export class AiModule {}
