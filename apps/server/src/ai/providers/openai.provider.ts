import { Injectable, Logger } from '@nestjs/common';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
  embedMany,
  LanguageModel,
} from 'ai';
import {
  AiProvider,
  ChatMessage,
  RagChunk,
} from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt } from '../utils/prompt.utils';
import { ConfigService } from '@nestjs/config';

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly defaultLanguageModel: LanguageModel;
  private readonly embeddingModel: any;
  private readonly defaultApiClient: any;
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly aiDebug: boolean;

  constructor(
    private readonly env: EnvironmentService,
    private readonly configService: ConfigService,
  ) {
    const driver = env.getAiDriver();
    const embeddingModelName = env.getAiEmbeddingModel() ?? 'embedding-3';

    this.aiDebug = this.configService.get<string>('AI_DEBUG') === 'true';

    const defaultConfig = this.getProviderConfig(driver);
    this.defaultApiClient = createOpenAICompatible({
      name: 'default',
      baseURL: defaultConfig.baseURL,
      apiKey: defaultConfig.apiKey,
    });

    const completionModel = env.getAiCompletionModel() ?? 'glm-4-flash';
    this.defaultLanguageModel = this.defaultApiClient(completionModel);
    this.embeddingModel = this.defaultApiClient.textEmbeddingModel(embeddingModelName);
  }

  private isThinkingModel(model: string): boolean {
    return model.startsWith('glm-') || model.startsWith('MiniMax-');
  }

  private getThinkingOptions(model: string, thinking?: boolean): object {
    if (!thinking || !this.isThinkingModel(model)) {
      return {};
    }

    return {
      thinking: {
        type: 'enabled',
        budgetTokens: 12000,
      },
    };
  }

  private getProviderConfig(driver: string): ProviderConfig {
    return {
      baseURL: this.env.getOpenAiApiUrl() ?? 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: this.env.getOpenAiApiKey() ?? '',
    };
  }

  private getApiClientForModel(model?: string): { client: any; model: LanguageModel } {
    if (!model) {
      return {
        client: this.defaultApiClient,
        model: this.defaultLanguageModel,
      };
    }

    let config: ProviderConfig;
    const modelName = model;

    if (model.startsWith('glm-')) {
      config = {
        baseURL: this.env.getOpenAiApiUrl() ?? 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: this.env.getOpenAiApiKey() ?? '',
      };
    } else if (model.startsWith('deepseek-')) {
      config = {
        baseURL: this.env.getDeepSeekApiUrl() ?? 'https://api.deepseek.com/v1',
        apiKey: this.env.getDeepSeekApiKey() ?? '',
      };
    } else if (model.startsWith('MiniMax-')) {
      config = {
        baseURL: this.env.getMiniMaxApiUrl() ?? 'https://api.minimax.chat/v1',
        apiKey: this.env.getMiniMaxApiKey() ?? '',
      };
    } else {
      return {
        client: this.defaultApiClient,
        model: this.defaultLanguageModel,
      };
    }

    const client = createOpenAICompatible({
      name: model,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });

    return {
      client,
      model: client(modelName),
    };
  }

  async generateText(
    systemPrompt: string,
    content: string,
    model?: string,
  ): Promise<string> {
    const { model: targetModel } = this.getApiClientForModel(model);
    const { text } = await aiGenerateText({
      model: targetModel,
      system: systemPrompt,
      prompt: content,
    });
    return text;
  }

  async streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    model?: string,
    onError?: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const { model: targetModel } = this.getApiClientForModel(model);
      const result = aiStreamText({
        model: targetModel,
        system: systemPrompt,
        prompt: content,
        abortSignal: signal,
      });
      for await (const chunk of result.textStream) {
        onChunk(chunk);
      }
      onComplete();
    } catch (error: any) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  async streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    model?: string,
    thinking?: boolean,
    onThinking?: (thinking: string) => void,
    onError?: (error: Error) => void,
    signal?: AbortSignal,
    aiSoul?: string,
    userProfile?: string,
  ): Promise<void> {
    try {
      const systemPrompt = buildRagSystemPrompt(ragContext, aiSoul, userProfile);
      const { model: targetModel } = this.getApiClientForModel(model);
      const modelId = model ?? this.env.getAiCompletionModel() ?? 'glm-4-flash';
      const thinkingOptions = this.getThinkingOptions(modelId, thinking);

      // AI Debug: Log system prompt and messages
      if (this.aiDebug) {
        this.logger.debug('=== LLM REQUEST ===');
        this.logger.debug(`Model: ${modelId}`);
        this.logger.debug(`Thinking: ${thinking}`);
        this.logger.debug(`AI Soul: ${aiSoul || 'none'}`);
        this.logger.debug(`User Profile: ${userProfile || 'none'}`);
        this.logger.debug(`--- SYSTEM PROMPT ---`);
        this.logger.debug(systemPrompt);
        this.logger.debug(`--- MESSAGES ---`);
        messages.forEach((m, i) => {
          this.logger.debug(`[${i}] ${m.role}: ${m.content.substring(0, 100)}...`);
        });
      }

      const result = await aiStreamText({
        model: targetModel,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...thinkingOptions,
        abortSignal: signal,
      });

      for await (const part of result.fullStream) {
        if (thinking && onThinking) {
          if (part.type === 'reasoning-delta') {
            onThinking(part.text);
          }
        }
        if (part.type === 'text-delta') {
          onChunk(part.text);
        }
      }

      onComplete();
    } catch (error: any) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: this.embeddingModel,
      values: texts,
    });
    return embeddings;
  }
}
