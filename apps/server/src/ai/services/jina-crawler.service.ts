import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CrawlResult {
  url: string;
  html: string;
  status: 'success' | 'failed';
  error?: string;
  fetchTime: number;
}

export interface CrawlUrlsOptions {
  concurrency?: number;
  timeoutMs?: number;
}

@Injectable()
export class JinaCrawlerService {
  private readonly logger = new Logger(JinaCrawlerService.name);
  private readonly JINA_API_URL = 'https://r.jina.ai/http://';
  private readonly JINA_API_KEY?: string;
  private readonly DEFAULT_TIMEOUT: number;
  private readonly DEFAULT_CONCURRENCY = 3;

  constructor(private readonly configService: ConfigService) {
    this.JINA_API_KEY = this.configService.get<string>('JINA_API_KEY');
    const configuredTimeout = Number(this.configService.get<string>('JINA_CRAWL_TIMEOUT_MS') || '15000');
    this.DEFAULT_TIMEOUT = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
      ? configuredTimeout
      : 15000;
  }

  /**
   * Crawl a single URL and return the HTML content
   */
  async crawlUrl(url: string, signal?: AbortSignal, timeoutMs?: number): Promise<CrawlResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Crawling URL: ${url}`);
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        return {
          url,
          html: '',
          status: 'failed',
          error: 'Invalid URL format',
          fetchTime: Date.now() - startTime,
        };
      }

      // Build Jina AI Reader URL
      const jinaUrl = `${this.JINA_API_URL}${encodeURIComponent(url)}`;
      
      // Set up headers
      const headers: Record<string, string> = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; Docmost-Research-Bot/1.0)',
      };
      
      if (this.JINA_API_KEY) {
        headers['Authorization'] = `Bearer ${this.JINA_API_KEY}`;
      }

      // Fetch with timeout and abort signal
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.DEFAULT_TIMEOUT);
      
      // Chain abort signals if provided
      const abortHandler = () => controller.abort();
      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      try {
        const response = await fetch(jinaUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }

        if (!response.ok) {
          return {
            url,
            html: '',
            status: 'failed',
            error: `HTTP ${response.status}: ${response.statusText}`,
            fetchTime: Date.now() - startTime,
          };
        }

        const html = await response.text();
        
        this.logger.log(`Successfully crawled ${url} in ${Date.now() - startTime}ms`);
        
        return {
          url,
          html,
          status: 'success',
          fetchTime: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`Failed to crawl ${url}: ${error.message}`);
      
      if (error.name === 'AbortError') {
        return {
          url,
          html: '',
          status: 'failed',
          error: 'Request timed out',
          fetchTime: Date.now() - startTime,
        };
      }

      return {
        url,
        html: '',
        status: 'failed',
        error: error.message,
        fetchTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Crawl multiple URLs with concurrency control
   */
  async crawlUrls(
    urls: string[],
    options: CrawlUrlsOptions = {},
    signal?: AbortSignal
  ): Promise<CrawlResult[]> {
    const concurrency = options.concurrency || this.DEFAULT_CONCURRENCY;
    
    if (urls.length === 0) {
      return [];
    }

    this.logger.log(`Crawling ${urls.length} URLs with concurrency ${concurrency}`);

    const results: CrawlResult[] = [];
    const queue = [...urls];
    let activeCount = 0;
    let index = 0;

    return new Promise((resolve, reject) => {
      const checkComplete = () => {
        if (activeCount === 0 && index >= queue.length) {
          this.logger.log(`Completed crawling all URLs. Success: ${results.filter(r => r.status === 'success').length}, Failed: ${results.filter(r => r.status === 'failed').length}`);
          resolve(results);
        }
      };

      const crawlNext = async () => {
        if (signal?.aborted) {
          reject(new Error('Crawling aborted'));
          return;
        }

        if (index >= queue.length) {
          checkComplete();
          return;
        }

        const currentIndex = index++;
        const url = queue[currentIndex];
        activeCount++;

        try {
          const result = await this.crawlUrl(url, signal, options.timeoutMs);
          results[currentIndex] = result;
        } finally {
          activeCount--;
          crawlNext();
        }
      };

      // Start concurrent crawlers
      const workers = Math.min(concurrency, queue.length);
      for (let i = 0; i < workers; i++) {
        crawlNext();
      }
    });
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Extract URLs from search results or text
   */
  extractUrlsFromText(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }
}