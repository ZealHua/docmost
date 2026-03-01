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
    this.log('Starting query rewrite for web search with full conversation context');

    try {
      // Build conversation context from all messages
      const conversationContext = messages
        .map((msg, index) => {
          const role = msg.role === 'user' ? 'Human' : 'Assistant';
          return `[Message ${index + 1} - ${role}]: ${msg.content}`;
        })
        .join('\n\n');

      const prompt = `You are a web search assistant. Analyze the entire conversation below to determine if the latest user message requires external web search (e.g., facts, news, current events, or information not present in the conversation history).

Consider:
- Does the user ask about recent events or current information?
- Does the user ask for facts not mentioned in the conversation?
- Does the user ask for details that would require external knowledge?
- Is it just a conversational continuation or greeting?

If web search is NOT needed, reply ONLY with "NO_SEARCH".
Otherwise, reply ONLY with a highly optimized, short Google search query designed to find the exact information the user is seeking based on the full conversation context.

Conversation to analyze:
${conversationContext}

Remember: Reply with ONLY "NO_SEARCH" or a search query.`;

      const provider = this.orchestrator.getProvider('glm-4.5');
      const rewritten = await provider.generateText('', prompt, 'glm-4.5');

      const trimmed = rewritten.trim();
      this.log(`Query rewritten to: "${trimmed}"`);
      return trimmed;
    } catch (e: any) {
      const errorMessage = e?.message || 'Unknown error';
      const errorStack = e?.stack || 'No stack trace';
      this.logger.error(`Failed to rewrite query: ${errorMessage}`, errorStack);
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
      })).slice(0, 10);

      this.log(`Web search returned ${results.length} results`);
      return { results };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      this.logger.error(`Search error: ${errorMessage}`, error);
      return { results: [], error: errorMessage };
    }
  }
}
