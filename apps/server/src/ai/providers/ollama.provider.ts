// Ollama is OpenAI-compatible via /v1/chat/completions.
// We use @ai-sdk/openai-compatible pointing to ${ollamaUrl}/v1 for completions.
// Embeddings use Ollama's native /api/embeddings endpoint directly.
import { Injectable } from '@nestjs/common';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText as aiGenerateText, streamText as aiStreamText, embedMany, LanguageModel } from 'ai';
import {
  AiProvider,
  ChatMessage,
  RagChunk,
} from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt } from '../utils/prompt.utils';

@Injectable()
export class OllamaProvider implements AiProvider {
  private readonly languageModel: LanguageModel;

  private readonly embeddingModel: any;
  private readonly ollamaBaseUrl: string;
  private readonly ollama: any;

  constructor(private readonly env: EnvironmentService) {
    this.ollamaBaseUrl = env.getOllamaApiUrl() ?? 'http://localhost:11434';
    this.ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL: `${this.ollamaBaseUrl}/v1`,
      apiKey: 'ollama', // Ollama does not require a real key
    });
    this.languageModel = this.ollama(env.getAiCompletionModel() ?? 'llama3');
    this.embeddingModel = this.ollama.textEmbeddingModel(
      env.getAiEmbeddingModel() ?? 'nomic-embed-text',
    );
  }

  async generateText(
    systemPrompt: string,
    content: string,
    model?: string,
  ): Promise<string> {
    const targetModel = model ? this.ollama(model) : this.languageModel;
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
      const targetModel = model ? this.ollama(model) : this.languageModel;
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
    _thinking?: boolean,
    _onThinking?: (thinking: string) => void,
    onError?: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const systemPrompt = buildRagSystemPrompt(ragContext);
      const targetModel = model ? this.ollama(model) : this.languageModel;
      const result = aiStreamText({
        model: targetModel,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
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

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: this.embeddingModel,
      values: texts,
    });
    return embeddings;
  }
}
