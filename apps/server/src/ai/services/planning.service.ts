import { Injectable, Logger } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

export interface ResearchPlan {
  id: string;
  title: string;
  description: string;
  steps: ResearchStep[];
  estimatedSources: number;
  estimatedTime: string;
  estimatedCost: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ResearchStep {
  id: string;
  type: 'search' | 'crawl' | 'analyze' | 'synthesize';
  title: string;
  description: string;
  query?: string;
  urls?: string[];
  dependencies?: string[];
  estimatedDuration: string;
  required: boolean;
}

export interface ResearchContext {
  hasInternalSources: boolean;
  hasWebSearch: boolean;
  selectedPages: Array<{
    pageId: string;
    title: string;
  }>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  clarificationRound: number;
}

export interface PlanValidation {
  isSufficient: boolean;
  missingSteps: string[];
  recommendations: string[];
  estimatedSuccessRate: number;
}

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(private readonly orchestrator: AiOrchestratorService) {}

  /**
   * Generate a research plan based on the query and context
   */
  async generatePlan(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    context: ResearchContext,
    signal?: AbortSignal
  ): Promise<ResearchPlan> {
    try {
      const prompt = this.buildPlanGenerationPrompt(messages, context);
      
      const provider = this.orchestrator.getProvider('glm-4.5');
      
      const response = await provider.generateText(
        '',
        prompt,
        'glm-4.5',
        signal
      );

      const plan = this.parsePlanResponse(response);
      
      this.logger.log(`Generated research plan with ${plan.steps ? plan.steps.length : 0} steps`);
      
      return plan;
    } catch (error: any) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      // Return a default plan as fallback
      return this.createDefaultPlan(messages, context);
    }
  }

  /**
   * Validate a research plan for completeness
   */
  async validatePlan(
    plan: ResearchPlan,
    context: ResearchContext,
    signal?: AbortSignal
  ): Promise<PlanValidation> {
    try {
      const prompt = this.buildPlanValidationPrompt(plan, context);
      
      const provider = this.orchestrator.getProvider('glm-4.5');
      
      const response = await provider.generateText(
        '',
        prompt,
        'glm-4.5',
        signal
      );

      return this.parseValidationResponse(response);
    } catch (error: any) {
      this.logger.error(`Error validating plan: ${error.message}`);
      // Return a permissive validation as fallback
      return {
        isSufficient: true,
        missingSteps: [],
        recommendations: ['Proceed with caution due to validation error'],
        estimatedSuccessRate: 0.7,
      };
    }
  }

  /**
   * Build prompt for plan generation
   */
  private buildPlanGenerationPrompt(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    context: ResearchContext
  ): string {
    const conversation = messages
      .map((msg, index) => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        return `[Message ${index + 1} - ${role}]: ${msg.content}`;
      })
      .join('\n\n');

    const currentDate = new Date().toISOString();

    return `You are an expert research planner. Create a detailed, step-by-step research plan based on the user's query and available resources.

Current Date: ${currentDate}

CONVERSATION CONTEXT:
${conversation}

AVAILABLE RESOURCES:
- Internal Knowledge Base: ${context.hasInternalSources ? `Yes (${context.selectedPages.length} pages selected)` : 'No'}
- Web Search: ${context.hasWebSearch ? 'Yes' : 'No'}
- Web Crawling: Yes (for full content extraction)
- Clarification Rounds Used: ${context.clarificationRound}

RESEARCH PLAN REQUIREMENTS:
1. Break down the research into logical, sequential steps
2. Include specific search queries for each search step
3. Identify which URLs to crawl for detailed information
4. Include analysis steps for processing collected data
5. Add a synthesis step for creating the final report
6. Estimate time and resources needed
7. Mark critical (required) vs optional steps
8. Consider the depth and breadth of research needed
9. For crawl steps, URLS must be either concrete http/https URLs or "none".
10. Never use placeholders such as "[URLs from step X results]".

RESPOND IN THIS EXACT FORMAT:

TITLE: [Concise title for the research plan]
DESCRIPTION: [Brief description of what the research will accomplish]

STEP 1:
TYPE: search|crawl|analyze|synthesize
TITLE: [Step title]
DESCRIPTION: [What this step accomplishes]
QUERY: [For search steps: specific search query]
URLS: [For crawl steps: specific URLs to crawl, comma-separated]
DEPENDENCIES: [Step IDs this depends on, comma-separated or "none"]
DURATION: [Estimated duration, e.g., "30s", "2m", "5m"]
REQUIRED: true|false

STEP 2:
[... continue for all steps ...]

ESTIMATED_SOURCES: [Number of sources expected to collect]
ESTIMATED_TIME: [Total estimated time, e.g., "2-3 minutes"]
ESTIMATED_COST: [Estimated cost in USD, e.g., "0.25"]
RISK_LEVEL: low|medium|high

Example Plan Structure:

TITLE: AI in Healthcare Market Analysis 2024
DESCRIPTION: Research the current market size, growth trends, and key players in AI healthcare applications

STEP 1:
TYPE: search
TITLE: Find current market size data
DESCRIPTION: Search for recent reports on AI healthcare market size in 2024
QUERY: AI healthcare market size 2024 USD billions
DEPENDENCIES: none
DURATION: 30s
REQUIRED: true

STEP 2:
TYPE: search
TITLE: Gather growth rate projections
DESCRIPTION: Find forecasts for AI healthcare market growth 2025-2030
QUERY: AI healthcare market growth forecast CAGR 2025-2030
DEPENDENCIES: none
DURATION: 30s
REQUIRED: true

STEP 3:
TYPE: crawl
TITLE: Extract detailed market reports
DESCRIPTION: Crawl top search results for comprehensive market data
URLS: none
DEPENDENCIES: step1,step2
DURATION: 60s
REQUIRED: true

STEP 4:
TYPE: analyze
TITLE: Calculate market projections
DESCRIPTION: Analyze collected data and create growth projections
DEPENDENCIES: step3
DURATION: 45s
REQUIRED: true

STEP 5:
TYPE: synthesize
TITLE: Generate comprehensive report
DESCRIPTION: Synthesize all findings into a structured report with citations
DEPENDENCIES: step4
DURATION: 30s
REQUIRED: true

ESTIMATED_SOURCES: 8-12
ESTIMATED_TIME: 3-4 minutes
ESTIMATED_COST: 0.35
RISK_LEVEL: medium`;
  }

  private buildPlanValidationPrompt(
    plan: ResearchPlan,
    context: ResearchContext
  ): string {
    const stepsDescription = (plan.steps || [])
      .map((step, index) => {
        return `${index + 1}. ${step.title} (${step.type}) - ${step.description}`;
      })
      .join('\n');

    return `You are an expert research validator. Review this research plan and identify any gaps or missing steps.

RESEARCH PLAN TO VALIDATE:
Title: ${plan.title}
Description: ${plan.description}

STEPS:
${stepsDescription}

CONTEXT:
- Internal Sources: ${context.hasInternalSources ? 'Yes' : 'No'}
- Web Search: ${context.hasWebSearch ? 'Yes' : 'No'}
- Selected Pages: ${context.selectedPages.length}
- Clarification Rounds: ${context.clarificationRound}

Evaluate if the plan:
1. Has sufficient search steps to gather comprehensive data
2. Includes crawling steps for detailed information
3. Has proper analysis steps for data processing
4. Includes synthesis for final report generation
5. Has appropriate dependencies between steps
6. Is realistic given the query complexity
7. Has proper risk assessment

RESPOND IN THIS FORMAT:

SUFFICIENT: true|false
SUCCESS_RATE: [0.0-1.0]
MISSING_STEPS: [comma-separated list of missing step types, or "none"]
RECOMMENDATIONS: [comma-separated list of recommendations, or "none"]

Example:
SUFFICIENT: true
SUCCESS_RATE: 0.85
MISSING_STEPS: none
RECOMMENDATIONS: Consider adding a step to verify data sources, Add timeout handling for crawl steps`;
  }

  /**
   * Parse plan generation response
   */
  private parsePlanResponse(response: string): ResearchPlan {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    const plan: Partial<ResearchPlan> = {
      steps: [],
    };

    let currentStep: Partial<ResearchStep> | null = null;

    for (const line of lines) {
      if (line.startsWith('STEP')) {
        // Save previous step if exists
        if (currentStep && currentStep.id) {
          plan.steps!.push(currentStep as ResearchStep);
        }
        // Start new step
        currentStep = { id: line.trim() };
      } else if (line.startsWith('TITLE:')) {
        if (!currentStep) {
          plan.title = line.substring('TITLE:'.length).trim();
        } else {
          currentStep.title = line.substring('TITLE:'.length).trim();
        }
      } else if (line.startsWith('DESCRIPTION:')) {
        if (!currentStep) {
          plan.description = line.substring('DESCRIPTION:'.length).trim();
        } else {
          currentStep.description = line.substring('DESCRIPTION:'.length).trim();
        }
      } else if (line.startsWith('TYPE:')) {
        if (currentStep) {
          currentStep.type = line.substring('TYPE:'.length).trim() as ResearchStep['type'];
        }
      } else if (line.startsWith('QUERY:')) {
        if (currentStep) {
          currentStep.query = line.substring('QUERY:'.length).trim();
        }
      } else if (line.startsWith('URLS:')) {
        if (currentStep) {
          const urlsStr = line.substring('URLS:'.length).trim();
          if (urlsStr && urlsStr !== 'none' && urlsStr !== '[]') {
            currentStep.urls = urlsStr.split(',').map(url => url.trim()).filter(url => url);
          }
        }
      } else if (line.startsWith('DEPENDENCIES:')) {
        if (currentStep) {
          const depsStr = line.substring('DEPENDENCIES:'.length).trim();
          if (depsStr && depsStr !== 'none') {
            currentStep.dependencies = depsStr.split(',').map(dep => dep.trim()).filter(dep => dep);
          }
        }
      } else if (line.startsWith('DURATION:')) {
        if (currentStep) {
          currentStep.estimatedDuration = line.substring('DURATION:'.length).trim();
        }
      } else if (line.startsWith('REQUIRED:')) {
        if (currentStep) {
          currentStep.required = line.substring('REQUIRED:'.length).trim().toLowerCase() === 'true';
        }
      } else if (line.startsWith('ESTIMATED_SOURCES:')) {
        plan.estimatedSources = parseInt(line.substring('ESTIMATED_SOURCES:'.length).trim()) || 0;
      } else if (line.startsWith('ESTIMATED_TIME:')) {
        plan.estimatedTime = line.substring('ESTIMATED_TIME:'.length).trim();
      } else if (line.startsWith('ESTIMATED_COST:')) {
        plan.estimatedCost = parseFloat(line.substring('ESTIMATED_COST:'.length).trim()) || 0;
      } else if (line.startsWith('RISK_LEVEL:')) {
        plan.riskLevel = line.substring('RISK_LEVEL:'.length).trim() as ResearchPlan['riskLevel'];
      }
    }

    // Add the last step
    if (currentStep && currentStep.id) {
      plan.steps!.push(currentStep as ResearchStep);
    }

    // Generate ID if not present
    if (!plan.id) {
      plan.id = `plan-${Date.now()}`;
    }

    // Set defaults for missing fields
    const stepsCount = plan.steps ? plan.steps.length : 0;
    if (!plan.estimatedSources) plan.estimatedSources = stepsCount * 2 || 5;
    if (!plan.estimatedTime) plan.estimatedTime = `${stepsCount * 0.5}-${stepsCount * 1} minutes`;
    if (!plan.estimatedCost) plan.estimatedCost = 0.1;
    if (!plan.riskLevel) plan.riskLevel = 'medium';

    if (!plan.steps || plan.steps.length === 0) {
      throw new Error('LLM failed to generate valid structured steps');
    }

    return plan as ResearchPlan;
  }

  /**
   * Parse validation response
   */
  private parseValidationResponse(response: string): PlanValidation {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    const validation: Partial<PlanValidation> = {
      missingSteps: [],
      recommendations: [],
    };

    for (const line of lines) {
      if (line.startsWith('SUFFICIENT:')) {
        validation.isSufficient = line.substring('SUFFICIENT:'.length).trim().toLowerCase() === 'true';
      } else if (line.startsWith('SUCCESS_RATE:')) {
        validation.estimatedSuccessRate = parseFloat(line.substring('SUCCESS_RATE:'.length).trim()) || 0.5;
      } else if (line.startsWith('MISSING_STEPS:')) {
        const missingStr = line.substring('MISSING_STEPS:'.length).trim();
        if (missingStr && missingStr !== 'none') {
          validation.missingSteps = missingStr.split(',').map(s => s.trim()).filter(s => s);
        }
      } else if (line.startsWith('RECOMMENDATIONS:')) {
        const recStr = line.substring('RECOMMENDATIONS:'.length).trim();
        if (recStr && recStr !== 'none') {
          validation.recommendations = recStr.split(',').map(s => s.trim()).filter(s => s);
        }
      }
    }

    // Set defaults
    if (validation.isSufficient === undefined) validation.isSufficient = true;
    if (validation.estimatedSuccessRate === undefined) validation.estimatedSuccessRate = 0.7;

    return validation as PlanValidation;
  }

  /**
   * Create a default plan as fallback
   */
  private createDefaultPlan(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    context: ResearchContext
  ): ResearchPlan {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

    return {
      id: `plan-fallback-${Date.now()}`,
      title: 'Research Plan',
      description: `Research plan for: ${query.substring(0, 100)}...`,
      steps: [
        {
          id: 'step-1',
          type: 'search',
          title: 'Initial research',
          description: 'Search for relevant information',
          query: query,
          dependencies: [],
          estimatedDuration: '30s',
          required: true,
        },
        {
          id: 'step-2',
          type: 'crawl',
          title: 'Extract detailed information',
          description: 'Crawl top results for comprehensive data',
          dependencies: ['step-1'],
          estimatedDuration: '60s',
          required: true,
        },
        {
          id: 'step-3',
          type: 'synthesize',
          title: 'Generate report',
          description: 'Synthesize findings into final report',
          dependencies: ['step-2'],
          estimatedDuration: '30s',
          required: true,
        },
      ],
      estimatedSources: 5,
      estimatedTime: '2-3 minutes',
      estimatedCost: 0.15,
      riskLevel: 'medium',
    };
  }
}