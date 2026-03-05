import { Injectable, Logger } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

export interface ClarificationResult {
  needsClarification: boolean;
  confidence: number;
}

export interface ClarificationQuestion {
  question: string;
  options?: string[];
  context: string;
}

export interface ClarificationContext {
  round: number;
  maxRounds: number;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

@Injectable()
export class ClarificationService {
  private readonly logger = new Logger(ClarificationService.name);
  private readonly MAX_CLARIFICATION_ROUNDS = 1;

  constructor(private readonly orchestrator: AiOrchestratorService) {}

  /**
   * Check if the query needs clarification
     */
  async needsClarification(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    clarificationRound: number = 0,
    signal?: AbortSignal
  ): Promise<ClarificationResult> {
    // If we've reached max rounds, don't ask for more clarification
    if (clarificationRound >= this.MAX_CLARIFICATION_ROUNDS) {
      return {
        needsClarification: false,
        confidence: 1.0,
      };
    }

    try {
      const prompt = this.buildNeedsClarificationPrompt(messages, clarificationRound);
      
      const provider = this.orchestrator.getProvider('glm-4.5');
      
      const response = await provider.generateText(
        '',
        prompt,
        'glm-4.5',
        signal
      );

      const trimmedResponse = response.trim().toUpperCase();
      
      // Parse response - expected format: "YES:confidence" or "NO:confidence"
      const [answer, confidenceStr] = trimmedResponse.split(':');
      const confidence = parseFloat(confidenceStr) || 0.5;

      const needsClarification = answer === 'YES';

      this.logger.log(`Clarification check: ${needsClarification ? 'YES' : 'NO'} (confidence: ${confidence})`);

      return {
        needsClarification,
        confidence,
      };
    } catch (error: any) {
      this.logger.error(`Error checking if clarification needed: ${error.message}`);
      // Fail open - assume no clarification needed if we can't determine
      return {
        needsClarification: false,
        confidence: 0.5,
      };
    }
  }

  /**
   * Generate a clarifying question
   */
  async generateClarification(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    clarificationRound: number = 0,
    signal?: AbortSignal
  ): Promise<ClarificationQuestion> {
    try {
      const prompt = this.buildClarificationPrompt(messages, clarificationRound);
      
      const provider = this.orchestrator.getProvider('glm-4.5');
      
      const response = await provider.generateText(
        '',
        prompt,
        'glm-4.5',
        signal
      );

      // Parse the response to extract question and options
      const parsed = this.parseClarificationResponse(response);

      this.logger.log(`Generated clarification question: ${parsed.question}`);

      return parsed;
    } catch (error: any) {
      this.logger.error(`Error generating clarification: ${error.message}`);
      // Return a generic clarification question as fallback
      return {
        question: "Can you provide more details about what you're looking for?",
        context: "I need more information to provide a helpful response.",
      };
    }
  }

  /**
   * Build prompt for checking if clarification is needed
   */
  private buildNeedsClarificationPrompt(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    clarificationRound: number
  ): string {
    const conversation = messages
      .map((msg, index) => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        return `[Message ${index + 1} - ${role}]: ${msg.content}`;
      })
      .join('\n\n');

    const currentDate = new Date().toISOString();

    return `You are an expert at determining when a user's query needs clarification. Analyze the conversation and determine if the latest user message is clear and specific enough to proceed with research.

Current Date: ${currentDate}
Clarification Round: ${clarificationRound + 1}/${this.MAX_CLARIFICATION_ROUNDS}

A query NEEDS clarification if it is:
- Too broad or vague (e.g., "Tell me about AI")
- Missing key details (timeframe, geography, scope, depth)
- Ambiguous with multiple interpretations
- Lacking specific context

A query does NOT need clarification if it is:
- Specific and well-defined
- Has clear parameters
- Provides enough context to proceed
- Can be answered with targeted research

Conversation to analyze:
${conversation}

Respond with ONLY one of these formats:
- "YES:0.85" if clarification is needed (confidence score 0.0-1.0)
- "NO:0.90" if no clarification is needed (confidence score 0.0-1.0)

Examples:
Query: "Tell me about AI" -> YES:0.95 (too broad)
Query: "Tell me about AI in healthcare" -> YES:0.80 (still broad, need specific aspect)
Query: "What is the market size of AI in healthcare in 2024?" -> NO:0.85 (specific enough)
Query: "Who won the Super Bowl?" -> NO:0.90 (clear and specific)`;
  }

  /**
   * Build prompt for generating clarification question
   */
  private buildClarificationPrompt(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    clarificationRound: number
  ): string {
    const conversation = messages
      .map((msg, index) => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        return `[Message ${index + 1} - ${role}]: ${msg.content}`;
      })
      .join('\n\n');

    const currentDate = new Date().toISOString();

    return `You are an expert at asking clarifying questions to help users refine their research queries. Generate a single, one-shot clarification that captures all important missing details.

Current Date: ${currentDate}
Clarification Round: ${clarificationRound + 1}/${this.MAX_CLARIFICATION_ROUNDS}

Generate a clarification question that:
1. Identifies all critical missing or ambiguous parts of the query in one shot
2. Asks ONE concise question that can cover multiple dimensions when needed (scope, timeframe, region, metric, source type)
3. Provides helpful options when appropriate (3-6 options max)
4. Is concise and easy to understand
5. Helps narrow down the research scope without requiring another follow-up

IMPORTANT:
- The system allows only one clarification turn.
- Do not ask multiple separate questions.
- If multiple details are missing, combine them into one compact question.
- Keep options short and directly actionable.

Conversation:
${conversation}

Respond in this format:
QUESTION: [Your clarifying question here]
OPTIONS: [Optional: comma-separated list of options]
CONTEXT: [Brief explanation of why clarification is needed]

Examples:

Example 1:
Query: "Tell me about AI in healthcare"
QUESTION: What aspect of AI in healthcare interests you most?
OPTIONS: Market size, Applications, Challenges, Regulations, Recent breakthroughs
CONTEXT: Healthcare AI is a broad field - focusing on a specific aspect will yield better research results.

Example 2:
Query: "How is the economy doing?"
QUESTION: Which economy and timeframe are you interested in?
OPTIONS: US economy, Global economy, European economy, Asian economy
CONTEXT: Economic conditions vary significantly by region and change over time.

Example 3:
Query: "Tell me about Tesla"
QUESTION: What specific information about Tesla would be most useful?
OPTIONS: Stock performance, Recent news, Product lineup, Financial results, Market position
CONTEXT: Tesla is a large company with many aspects to research - focusing will provide more valuable insights.`;
  }

  /**
   * Parse clarification response
   */
  private parseClarificationResponse(response: string): ClarificationQuestion {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    const result: ClarificationQuestion = {
      question: '',
      context: '',
    };

    for (const line of lines) {
      if (line.startsWith('QUESTION:')) {
        result.question = line.substring('QUESTION:'.length).trim();
      } else if (line.startsWith('OPTIONS:')) {
        const optionsStr = line.substring('OPTIONS:'.length).trim();
        if (optionsStr) {
          result.options = optionsStr
            .split(',')
            .map(opt => opt.trim())
            .filter(opt => opt.length > 0);
        }
      } else if (line.startsWith('CONTEXT:')) {
        result.context = line.substring('CONTEXT:'.length).trim();
      }
    }

    // Fallback if parsing fails
    if (!result.question) {
      result.question = "Can you provide more details about what you're looking for?";
      result.context = "I need more information to provide a helpful response.";
    }

    return result;
  }

  /**
   * Get maximum allowed clarification rounds
   */
  getMaxClarificationRounds(): number {
    return this.MAX_CLARIFICATION_ROUNDS;
  }

  /**
   * Check if clarification round limit has been reached
   */
  isMaxRoundsReached(clarificationRound: number): boolean {
    return clarificationRound >= this.MAX_CLARIFICATION_ROUNDS;
  }
}