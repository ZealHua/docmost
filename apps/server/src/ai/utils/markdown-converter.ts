import * as TurndownService from 'turndown';

/**
 * Utility class for converting HTML to Markdown
 */
export class MarkdownConverter {
  private static turndownService: TurndownService;

  static {
    // Initialize TurndownService with optimized settings
    MarkdownConverter.turndownService = new TurndownService({
      headingStyle: 'atx', // Use # for headings instead of underlines
      codeBlockStyle: 'fenced', // Use ``` for code blocks
      bulletListMarker: '-', // Use - for bullet lists
      emDelimiter: '*', // Use * for emphasis
    });

    // Custom rule for better code block handling
    MarkdownConverter.turndownService.addRule('fencedCodeBlocks', {
      filter: (node) => {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild !== null &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: (content, node) => {
        const codeElement = (node as Element).querySelector('code');
        const language = codeElement?.className.match(/language-(\w+)/)?.[1] || '';
        const codeContent = codeElement?.textContent || content;
        
        // Ensure proper spacing around code blocks
        return '\n\n```' + language + '\n' + codeContent + '\n```\n\n';
      },
    });

    // Remove unwanted elements
    MarkdownConverter.turndownService.remove([
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      'iframe',
      'noscript',
    ]);

    // Custom rule for links
    MarkdownConverter.turndownService.addRule('links', {
      filter: 'a',
      replacement: (content, node) => {
        const href = (node as Element).getAttribute('href');
        const title = (node as Element).getAttribute('title');
        
        if (!href) return content;
        
        // Skip empty links
        if (!content.trim()) return '';
        
        const titlePart = title ? ` "${title}"` : '';
        return `[${content}](${href}${titlePart})`;
      },
    });

    // Custom rule for images
    MarkdownConverter.turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const src = (node as Element).getAttribute('src');
        const alt = (node as Element).getAttribute('alt') || '';
        const title = (node as Element).getAttribute('title');
        
        if (!src) return '';
        
        const titlePart = title ? ` "${title}"` : '';
        return `![${alt}](${src}${titlePart})`;
      },
    });
  }

  /**
   * Convert HTML string to Markdown
   */
  static convert(html: string): string {
    if (!html || html.trim() === '') {
      return '';
    }

    try {
      // Remove excessive whitespace
      const cleanedHtml = html
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .trim();

      return MarkdownConverter.turndownService.turndown(cleanedHtml);
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      // Fallback: return plain text by stripping HTML tags
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Sanitize HTML before conversion
   */
  static sanitize(html: string): string {
    // Remove potentially dangerous elements and attributes
    return html
      // Remove script tags and their content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove style tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove onclick and other event handlers
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
      .replace(/\s+on\w+=[^\s>]+/gi, '')
      // Remove javascript: URLs
      .replace(/href="javascript:[^"]*"/gi, 'href="#"')
      .replace(/href='javascript:[^']*'/gi, "href='#'");
  }

  /**
   * Convert and sanitize HTML to Markdown
   */
  static convertSafe(html: string): string {
    const sanitized = MarkdownConverter.sanitize(html);
    return MarkdownConverter.convert(sanitized);
  }

  /**
   * Extract text content from HTML (strip all tags)
   */
  static extractText(html: string): string {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Decode ampersands
      .replace(/&lt;/g, '<') // Decode less than
      .replace(/&gt;/g, '>') // Decode greater than
      .replace(/&quot;/g, '"') // Decode quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}
