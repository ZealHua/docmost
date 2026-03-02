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

      const currentDate = new Date().toISOString();
      const currentYear = new Date().getFullYear();

      const prompt = `System:
You are an expert web search query generator. Analyze the entire conversation below to determine if the latest user message requires an external web search.

Search is NEEDED for: Up-to-date facts, news, weather, specific external knowledge, or verifying claims.
Search is NOT NEEDED for: Greetings, conversational pleasantries, simple logic, or tasks that rely purely on the provided history.

Current Date and Time: ${currentDate}

Rules for creating the search query:

Resolve Context: Replace pronouns (he, she, it, they, this) with the specific names or subjects mentioned earlier in the conversation.

Use Keywords: Strip out conversational filler. Use concise search keywords instead of full natural-language questions (e.g., use "Tesla stock price today" instead of "What is the price of Tesla stock today?").

Be Specific: Include relevant dates, locations, or entities to narrow down the search.

Examples:

User: "Hi there!" -> NO_SEARCH

User: "Who won the Super Bowl?" -> Super Bowl winner ${currentYear}

User: "What is the capital of France?" -> capital of France

User: "How tall is Ryan Reynolds?" | Assistant: "He is 6'2." | User: "Who is his wife?" -> Ryan Reynolds wife

If search is NOT needed, reply strictly with: NO_SEARCH
If search IS needed, reply strictly with the raw search query string. Do NOT wrap the query in quotes, do NOT use markdown, and do NOT add explanations.

Conversation to analyze:
${conversationContext}`;

      const provider = this.orchestrator.getProvider('glm-4.5');

      // Add 3000ms timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const rewritten = await provider.generateText('', prompt, 'glm-4.5', controller.signal);
        clearTimeout(timeoutId);

        const trimmed = rewritten.trim();
        this.log(`Query rewritten to: "${trimmed}"`);
        return trimmed;
      } catch (abortError: any) {
        clearTimeout(timeoutId);
        if (abortError.name === 'AbortError') {
          this.warn('Query rewrite timed out after 3000ms, falling back to NO_SEARCH');
          return 'NO_SEARCH';
        }
        throw abortError;
      }
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
      // Add 3000ms timeout for Serper API fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({ query: query.slice(0, 2000), categories: ['SEARCH'] }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
      } catch (abortError: any) {
        clearTimeout(timeoutId);
        if (abortError.name === 'AbortError') {
          this.warn('Serper API fetch timed out after 3000ms');
          return { results: [], error: 'Timeout' };
        }
        throw abortError;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      this.logger.error(`Search error: ${errorMessage}`, error);
      return { results: [], error: errorMessage };
    }
  }
}
