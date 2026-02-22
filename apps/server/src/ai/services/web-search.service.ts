import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiOrchestratorService } from './ai-orchestrator.service';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly debug: boolean;

  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly configService: ConfigService,
  ) {
    this.debug = this.configService.get<string>('SERPER_DEBUG') === 'true';
  }

  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      this.logger.log(message, ...args);
    }
  }

  private warn(message: string, ...args: any[]): void {
    if (this.debug) {
      this.logger.warn(message, ...args);
    }
  }

  async rewriteQuery(messages: any[]): Promise<string> {
    this.log('Starting query rewrite for web search');

    try {
      const prompt = `You are a web search assistant. Determine if the user's latest message requires external web search (e.g., facts, news, current events). 
If it is a conversational greeting or can be answered without searching, reply ONLY with "NO_SEARCH". 
Otherwise, reply ONLY with a highly optimized, short Google search query designed to find the exact information.
Do not use quotes or prefixes in the output.`;

      const userMessage = messages[messages.length - 1].content;
      
      const provider = this.orchestrator.getProvider('glm-4.5');
      const rewritten = await provider.generateText(prompt, userMessage, 'glm-4.5');
      
      const trimmed = rewritten.trim();
      this.log(`Query rewritten to: "${trimmed}"`);
      return trimmed;
    } catch (e) {
      this.logger.error('Failed to rewrite query', e);
      return 'NO_SEARCH';
    }
  }

  async search(query: string): Promise<SearchResponse> {
    const url = this.configService.get<string>('SERPER_PROXY');
    const token = this.configService.get<string>('SERPER_PROXY_TOKEN');

    this.log(`Starting web search for query: "${query}"`);

    if (!url) {
      const error = 'SERPER_PROXY is not configured in environment variables.';
      this.warn(error);
      return { results: [], error };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ query: query.slice(0, 2000), categories: ['SEARCH'] }),
      });

      this.log(`Serper response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        const error = `Serper API error: ${response.status} ${errorText}`;
        this.logger.error(error);
        return { results: [], error };
      }
      
      const data = await response.json();

      if (!data.organic) {
        this.log('No organic results found');
        return { results: [] };
      }

      const results = data.organic.map((c: any) => ({
        title: c.title,
        url: c.link,
        content: c.snippet || '',
      })).slice(0, 5);

      this.log(`Web search returned ${results.length} results`);
      return { results };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      this.logger.error(`Search error: ${errorMessage}`, error);
      return { results: [], error: errorMessage };
    }
  }
}
