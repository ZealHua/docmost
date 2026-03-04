import { ResearchPlan, ResearchStep } from '../services/planning.service';

export interface EstimatedUsage {
  webSearches: number;
  crawlUrls: number;
  llmTokens: number;
  estimatedCost: number;
}

export interface ActualUsage {
  researchRequests: number;
  webSearches: number;
  crawlUrls: number;
  llmTokens: number;
  cost: number;
}

export interface ResearchOperation {
  operationType: 'web_search' | 'crawl_url' | 'llm_query';
  operationDetails: {
    query?: string;
    url?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
  costAmount: number;
}

/**
 * Cost estimation and tracking for deep research operations
 */
export class CostEstimator {
  // Cost rates (in USD)
  private static readonly COST_RATES = {
    webSearch: 0.005, // $0.005 per search (Serper API)
    crawlUrl: 0.001, // $0.001 per URL (Jina AI)
    llmToken: 0.00001, // $0.00001 per token (average rate)
    // Model-specific rates can be added here
    models: {
      'glm-4.5': { input: 0.00002, output: 0.00004 },
      'glm-4.7-flash': { input: 0.000005, output: 0.00001 },
    },
  };

  /**
   * Estimate resource usage and cost from a research plan
   */
  static estimateResearchCost(plan: ResearchPlan): EstimatedUsage {
    const steps = plan.steps || [];
    const searchSteps = steps.filter(s => s.type === 'search');
    const crawlSteps = steps.filter(s => s.type === 'crawl');
    const analyzeSteps = steps.filter(s => s.type === 'analyze');

    // Estimate web searches (assume 2-3 searches per search step)
    const estimatedWebSearches = searchSteps.length * 3;

    // Estimate crawl URLs (assume 3-5 URLs per crawl step)
    const estimatedCrawlUrls = crawlSteps.length * 5;

    // Estimate LLM tokens
    // - Clarification: ~2000 tokens
    // - Planning: ~3000 tokens
    // - Search query generation: ~500 tokens per search step
    // - Analysis: ~8000 tokens per analyze step
    // - Synthesis: ~15000 tokens
    const estimatedLLMTokens =
      2000 + // Clarification
      3000 + // Planning
      (searchSteps.length * 500) + // Search query generation
      (analyzeSteps.length * 8000) + // Analysis
      15000; // Synthesis

    // Calculate estimated cost
    const estimatedCost =
      (estimatedWebSearches * this.COST_RATES.webSearch) +
      (estimatedCrawlUrls * this.COST_RATES.crawlUrl) +
      (estimatedLLMTokens * this.COST_RATES.llmToken);

    return {
      webSearches: estimatedWebSearches,
      crawlUrls: estimatedCrawlUrls,
      llmTokens: estimatedLLMTokens,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    };
  }

  /**
   * Calculate actual cost from research operations
   */
  static calculateActualCost(operations: ResearchOperation[]): number {
    return operations.reduce((total, op) => {
      return total + op.costAmount;
    }, 0);
  }

  /**
   * Create a web search operation record
   */
  static createWebSearchOperation(query: string): ResearchOperation {
    return {
      operationType: 'web_search',
      operationDetails: { query },
      costAmount: this.COST_RATES.webSearch,
    };
  }

  /**
   * Create a crawl URL operation record
   */
  static createCrawlUrlOperation(url: string): ResearchOperation {
    return {
      operationType: 'crawl_url',
      operationDetails: { url },
      costAmount: this.COST_RATES.crawlUrl,
    };
  }

  /**
   * Create an LLM query operation record
   */
  static createLlmQueryOperation(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): ResearchOperation {
    // Use model-specific rates if available
    const modelRates = this.COST_RATES.models[model as keyof typeof this.COST_RATES.models];
    
    let costAmount: number;
    if (modelRates) {
      costAmount = (inputTokens * modelRates.input) + (outputTokens * modelRates.output);
    } else {
      costAmount = (inputTokens + outputTokens) * this.COST_RATES.llmToken;
    }

    return {
      operationType: 'llm_query',
      operationDetails: {
        model,
        inputTokens,
        outputTokens,
      },
      costAmount: parseFloat(costAmount.toFixed(4)),
    };
  }

  /**
   * Calculate tokens from text (rough estimation)
   * Rule of thumb: 1 token ≈ 0.75 words
   */
  static estimateTokensFromText(text: string): number {
    if (!text || text.trim() === '') {
      return 0;
    }

    // Split by whitespace and count non-empty words
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const estimatedTokens = Math.ceil(words.length * 1.33); // 1 word ≈ 1.33 tokens
    
    return estimatedTokens;
  }

  /**
   * Check if workspace has sufficient quota
   */
  static checkQuotaSufficiency(
    currentUsage: ActualUsage,
    limits: {
      researchRequests: number;
      webSearches: number;
      crawlUrls: number;
      llmTokens: number;
    },
    estimatedUsage: EstimatedUsage
  ): { sufficient: boolean; exceeded: string[] } {
    const exceeded: string[] = [];

    if (currentUsage.webSearches + estimatedUsage.webSearches > limits.webSearches) {
      exceeded.push('web_searches');
    }

    if (currentUsage.crawlUrls + estimatedUsage.crawlUrls > limits.crawlUrls) {
      exceeded.push('crawl_urls');
    }

    if (currentUsage.llmTokens + estimatedUsage.llmTokens > limits.llmTokens) {
      exceeded.push('llm_tokens');
    }

    return {
      sufficient: exceeded.length === 0,
      exceeded,
    };
  }

  /**
   * Format cost for display
   */
  static formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(3)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  }

  /**
   * Get cost breakdown for a research session
   */
  static getCostBreakdown(operations: ResearchOperation[]): {
    webSearchCost: number;
    crawlUrlCost: number;
    llmQueryCost: number;
    totalCost: number;
  } {
    const webSearchCost = operations
      .filter(op => op.operationType === 'web_search')
      .reduce((sum, op) => sum + op.costAmount, 0);

    const crawlUrlCost = operations
      .filter(op => op.operationType === 'crawl_url')
      .reduce((sum, op) => sum + op.costAmount, 0);

    const llmQueryCost = operations
      .filter(op => op.operationType === 'llm_query')
      .reduce((sum, op) => sum + op.costAmount, 0);

    return {
      webSearchCost: parseFloat(webSearchCost.toFixed(4)),
      crawlUrlCost: parseFloat(crawlUrlCost.toFixed(4)),
      llmQueryCost: parseFloat(llmQueryCost.toFixed(4)),
      totalCost: parseFloat((webSearchCost + crawlUrlCost + llmQueryCost).toFixed(4)),
    };
  }
}
