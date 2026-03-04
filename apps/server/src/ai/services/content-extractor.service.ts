import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as TurndownService from 'turndown';
import { CrawlResult } from './jina-crawler.service';

export interface ExtractedContent {
  title: string;
  content: string; // Markdown
  excerpt: string;
  wordCount: number;
  readingTime: number; // in minutes
  author?: string;
  publishedDate?: string;
  url: string;
}

@Injectable()
export class ContentExtractorService {
  private readonly logger = new Logger(ContentExtractorService.name);
  private turndownService: TurndownService;

  constructor() {
    // Initialize TurndownService with custom rules
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Custom rule to preserve code blocks
    this.turndownService.addRule('preserveCodeBlocks', {
      filter: (node) => {
        return node.nodeName === 'PRE' || node.nodeName === 'CODE';
      },
      replacement: (content, node) => {
        if (node.nodeName === 'PRE') {
          const codeElement = node.querySelector('code');
          const language = codeElement?.className.match(/language-(\w+)/)?.[1] || '';
          const codeContent = codeElement?.textContent || content;
          return `\n\n\`\`\`${language}\n${codeContent}\n\`\`\`\n\n`;
        }
        return '`' + content + '`';
      },
    });

    // Remove unnecessary elements
    this.turndownService.remove(['script', 'style', 'nav', 'header', 'footer', 'aside']);
  }

  /**
   * Extract article content from HTML using Mozilla Readability
   */
  async extractContent(html: string, url: string): Promise<ExtractedContent> {
    try {
      this.logger.log(`Extracting content from ${url}`);
      
      // Create JSDOM instance
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Use Readability to extract article content
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        throw new Error('Failed to extract readable content from HTML');
      }

      // Convert HTML content to Markdown
      const markdownContent = this.turndownService.turndown(article.content);

      // Calculate word count and reading time
      const wordCount = this.countWords(markdownContent);
      const readingTime = Math.ceil(wordCount / 200); // 200 words per minute average

      const extracted: ExtractedContent = {
        title: article.title || '',
        content: markdownContent,
        excerpt: article.excerpt || this.generateExcerpt(markdownContent),
        wordCount,
        readingTime,
        author: article.byline || undefined,
        publishedDate: article.dir || undefined,
        url,
      };

      this.logger.log(`Successfully extracted ${wordCount} words from ${url}`);
      
      return extracted;
    } catch (error: any) {
      this.logger.error(`Failed to extract content from ${url}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract content from a crawl result
   */
  async extractFromCrawlResult(crawlResult: CrawlResult): Promise<ExtractedContent> {
    if (crawlResult.status === 'failed') {
      throw new Error(`Cannot extract content from failed crawl: ${crawlResult.error}`);
    }

    return this.extractContent(crawlResult.html, crawlResult.url);
  }

  /**
   * Extract content from multiple crawl results
   */
  async extractFromCrawlResults(crawlResults: CrawlResult[]): Promise<ExtractedContent[]> {
    const successfulResults = crawlResults.filter(r => r.status === 'success');
    
    const extractions = await Promise.allSettled(
      successfulResults.map(result => this.extractFromCrawlResult(result))
    );

    const extractedContents: ExtractedContent[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    extractions.forEach((result, index) => {
      const crawlResult = successfulResults[index];
      if (result.status === 'fulfilled') {
        extractedContents.push(result.value);
      } else {
        errors.push({
          url: crawlResult.url,
          error: result.reason.message,
        });
        this.logger.warn(`Failed to extract content from ${crawlResult.url}: ${result.reason.message}`);
      }
    });

    if (errors.length > 0) {
      this.logger.warn(`Failed to extract ${errors.length} of ${crawlResults.length} URLs`);
    }

    return extractedContents;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    // Remove markdown syntax and count words
    const cleaned = text
      .replace(/[#*`\[\]]/g, ' ') // Remove markdown symbols
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleaned.split(' ').filter(word => word.length > 0).length;
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(content: string, maxLength: number = 300): string {
    // Remove markdown syntax
    const cleaned = content
      .replace(/[#*`\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    return cleaned.substring(0, maxLength).trim() + '...';
  }

  /**
   * Truncate content to maximum token limit
   */
  truncateContent(content: string, maxTokens: number = 4000): string {
    // Rough estimation: 1 token ≈ 0.75 words
    const maxWords = Math.floor(maxTokens * 0.75);
    const words = content.split(' ');
    
    if (words.length <= maxWords) {
      return content;
    }
    
    return words.slice(0, maxWords).join(' ') + '...';
  }
}