import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { OpenAiProvider } from '../providers/openai.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { MODEL_CONFIG } from '../models.config';

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly env: EnvironmentService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly ollamaProvider: OllamaProvider,
  ) {}

  getProvider(model?: string): AiProvider {
    let driver = this.env.getAiDriver();

    if (model && MODEL_CONFIG[model]) {
      const config = MODEL_CONFIG[model];
      driver = config.provider;
    }

    switch (driver) {
      case 'openai':
      case 'openai-compatible': // ZhipuAI, DeepSeek, Groq, etc.
        return this.openAiProvider;
      case 'google':
      case 'gemini':
        return this.geminiProvider;
      case 'ollama':
        return this.ollamaProvider;
      case 'anthropic':
        // Anthropic not yet implemented, but we can fall back to openai if needed
        // For now, let's throw an error if it's explicitly requested
        throw new ServiceUnavailableException(
          `Provider "anthropic" for model "${model}" is not yet implemented.`,
        );
      default:
        throw new ServiceUnavailableException(
          `Unknown AI driver: "${driver}". ` +
            `Set AI_DRIVER to one of: openai, openai-compatible, gemini, ollama`,
        );
    }
  }

  /**
   * Returns true if AI_DRIVER is set to a non-empty, recognised value.
   * Used by controllers to return a clean 503 instead of a generic 500
   * when AI is not configured.
   */
  isConfigured(): boolean {
    const driver = this.env.getAiDriver();
    return ['openai', 'openai-compatible', 'gemini', 'ollama'].includes(
      driver ?? '',
    );
  }
}
