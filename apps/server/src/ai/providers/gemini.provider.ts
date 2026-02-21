import { Injectable, NotImplementedException } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText as aiGenerateText, streamText as aiStreamText, LanguageModel } from 'ai';
import {
  AiProvider,
  ChatMessage,
  RagChunk,
} from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt } from '../utils/prompt.utils';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly languageModel: LanguageModel;
  private readonly google: any;

  constructor(private readonly env: EnvironmentService) {
    this.google = createGoogleGenerativeAI({ apiKey: env.getGeminiApiKey() });
    this.languageModel = this.google(
      env.getAiCompletionModel() ?? 'gemini-1.5-flash',
    );
  }

  async generateText(
    systemPrompt: string,
    content: string,
    model?: string,
  ): Promise<string> {
    const targetModel = model ? this.google(model) : this.languageModel;
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
      const targetModel = model ? this.google(model) : this.languageModel;
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
      const targetModel = model ? this.google(model) : this.languageModel;
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

  async generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new NotImplementedException(
      'Gemini embedding support not yet implemented. ' +
        'Use AI_DRIVER=openai-compatible for embeddings.',
    );
  }
}
