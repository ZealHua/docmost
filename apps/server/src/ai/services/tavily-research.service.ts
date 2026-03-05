import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';

export interface TavilyResearchItem {
  title: string;
  url: string;
  content: string;
}

export interface TavilyResearchResponse {
  results: TavilyResearchItem[];
  error?: string;
}

@Injectable()
export class TavilyResearchService {
  private readonly logger = new Logger(TavilyResearchService.name);
  private readonly debug: boolean;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.debug = this.configService.get<string>('AI_DEBUG') === 'true';
    this.apiKey = this.configService.get<string>('TAVILY_API_KEY');
    const configuredTimeout = Number(this.configService.get<string>('TAVILY_TIMEOUT_MS') || '5000');
    this.timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
      ? configuredTimeout
      : 5000;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async research(query: string): Promise<TavilyResearchResponse> {
    return this.search(query);
  }

  async search(query: string): Promise<TavilyResearchResponse> {
    if (!this.apiKey) {
      return { results: [], error: 'TAVILY_API_KEY is not configured.' };
    }

    if (!query || query.trim().length === 0) {
      return { results: [], error: 'Search query is empty.' };
    }

    try {
      const client = tavily({ apiKey: this.apiKey }) as any;
      const requestFn = typeof client.search === 'function'
        ? client.search.bind(client)
        : client.research.bind(client);

      const response = await Promise.race([
        requestFn(query.trim()),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), this.timeoutMs);
        }),
      ]);

      const rawResults = Array.isArray((response as any)?.results)
        ? (response as any).results
        : [];

      const results = rawResults
        .map((item: any) => ({
          title: typeof item?.title === 'string' ? item.title : '',
          url: typeof item?.url === 'string' ? item.url : '',
          content:
            typeof item?.snippet === 'string'
              ? item.snippet
              : typeof item?.content === 'string'
              ? item.content
              : typeof item?.excerpt === 'string'
              ? item.excerpt
              : '',
        }))
        .filter((item: TavilyResearchItem) => item.url && item.title)
        .slice(0, 5);

      if (this.debug) {
        this.logger.log(`Tavily search returned ${results.length} result(s)`);
      }

      return { results };
    } catch (error: any) {
      const message = error?.message || 'Unknown Tavily error';
      this.logger.warn(`Tavily search failed: ${message}`);
      return { results: [], error: message };
    }
  }
}
