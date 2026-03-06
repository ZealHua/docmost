import { Injectable, Logger } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

export interface ClarificationResult {
  needsClarification: boolean;
  confidence: number;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[];
  required?: boolean;
}

export interface ClarificationBundle {
  questions: ClarificationQuestion[];
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
  ): Promise<ClarificationBundle> {
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

      this.logger.log(`Generated ${parsed.questions.length} clarification question(s)`);

      return parsed;
    } catch (error: any) {
      this.logger.error(`Error generating clarification: ${error.message}`);
      // Return a generic clarification question as fallback
      return {
        questions: [
          {
            id: 'q1',
            question: "Can you provide more details about what you're looking for?",
            required: true,
          },
        ],
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

Generate 2-3 clarification questions in one shot that together capture all critical missing details.

IMPORTANT:
- The system allows only one clarification turn.
- Ask 2-3 compact questions that can be answered quickly in one form.
- Keep each question short and directly actionable.
- Each question may include 3-6 options when appropriate.

Conversation:
${conversation}

Respond with VALID JSON only in this exact shape:
{
  "context": "Brief explanation of why clarification is needed",
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "required": true,
      "options": ["...", "..."]
    }
  ]
}

Rules:
- questions length must be 2 or 3
- id must be unique and stable (q1, q2, q3)
- required must be true for all questions
- options are optional and should be short labels
- no markdown, no prose, JSON only

Examples:

Example 1:
Query: "Tell me about AI in healthcare"
{
  "context": "Healthcare AI is broad. A tighter scope improves research quality.",
  "questions": [
    {
      "id": "q1",
      "question": "Which healthcare segment should we focus on?",
      "required": true,
      "options": ["Hospitals", "Diagnostics", "Pharma", "Payers", "Public health"]
    },
    {
      "id": "q2",
      "question": "What outcome do you care about most?",
      "required": true,
      "options": ["Market size", "Use cases", "ROI", "Risks", "Regulation"]
    }
  ]
}

Example 2:
Query: "How is the economy doing?"
{
  "context": "Economic conditions vary by region and period.",
  "questions": [
    {
      "id": "q1",
      "question": "Which geography should we analyze?",
      "required": true,
      "options": ["US", "Global", "Europe", "China", "ASEAN"]
    },
    {
      "id": "q2",
      "question": "Which time horizon should we use?",
      "required": true,
      "options": ["Last 12 months", "Last 3 years", "Current quarter", "Forward 12 months"]
    }
  ]
}

Example 3:
Query: "Tell me about Tesla"
{
  "context": "Tesla has multiple dimensions requiring scope clarification.",
  "questions": [
    {
      "id": "q1",
      "question": "Which Tesla topic is the priority?",
      "required": true,
      "options": ["Financials", "Vehicle demand", "Autonomy", "Energy business", "Competition"]
    },
    {
      "id": "q2",
      "question": "What level of depth do you want?",
      "required": true,
      "options": ["Executive brief", "Detailed analysis", "Data-heavy benchmarking"]
    }
  ]
}`;
  }

  /**
   * Parse clarification response
   */
  private parseClarificationResponse(response: string): ClarificationBundle {
    const trimmed = response.trim();

    try {
      const parsed = JSON.parse(trimmed) as {
        context?: string;
        questions?: Array<{ id?: string; question?: string; options?: string[]; required?: boolean }>;
      };

      const questions = (parsed.questions || [])
        .map((item, index) => ({
          id: item.id?.trim() || `q${index + 1}`,
          question: item.question?.trim() || '',
          options: Array.isArray(item.options)
            ? item.options.map(opt => opt?.trim()).filter(Boolean) as string[]
            : undefined,
          required: item.required !== false,
        }))
        .filter(item => item.question.length > 0)
        .slice(0, 3);

      if (questions.length >= 2) {
        return {
          context: parsed.context?.trim() || 'A few details are needed before research begins.',
          questions,
        };
      }
    } catch {
      // continue to fallback parsing
    }

    const lines = trimmed.split('\n').map(line => line.trim()).filter(line => line);
    let fallbackQuestion = '';
    let fallbackContext = '';
    let fallbackOptions: string[] | undefined;

    for (const line of lines) {
      if (line.startsWith('QUESTION:')) {
        fallbackQuestion = line.substring('QUESTION:'.length).trim();
      } else if (line.startsWith('OPTIONS:')) {
        const optionsStr = line.substring('OPTIONS:'.length).trim();
        if (optionsStr) {
          fallbackOptions = optionsStr
            .split(',')
            .map(opt => opt.trim())
            .filter(opt => opt.length > 0);
        }
      } else if (line.startsWith('CONTEXT:')) {
        fallbackContext = line.substring('CONTEXT:'.length).trim();
      }
    }

    if (!fallbackQuestion) {
      fallbackQuestion = "Can you provide more details about what you're looking for?";
      fallbackContext = fallbackContext || "I need more information to provide a helpful response.";
    }

    return {
      context: fallbackContext || 'A few details are needed before research begins.',
      questions: [
        {
          id: 'q1',
          question: fallbackQuestion,
          options: fallbackOptions,
          required: true,
        },
      ],
    };
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