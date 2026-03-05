import { setup, assign } from 'xstate';

export interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClarificationQuestion {
  question: string;
  options?: string[];
  context: string;
}

export interface ResearchPlan {
  id: string;
  title: string;
  description: string;
  steps: Array<{
    id: string;
    type: 'search' | 'crawl' | 'analyze' | 'synthesize';
    title: string;
    description: string;
    query?: string;
    urls?: string[];
    dependencies?: string[];
    estimatedDuration: string;
    required: boolean;
  }>;
  estimatedSources: number;
  estimatedTime: string;
  estimatedCost: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ResearchSource {
  url: string;
  title: string;
  excerpt: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason: string;
  exceeded?: Array<{
    resource: string;
    used: number;
    limit: number;
    needed: number;
  }>;
}

export interface DeepResearchContext {
  messages: ResearchMessage[];
  clarificationRound: number;
  clarificationQuestion?: ClarificationQuestion;
  researchPlan?: ResearchPlan;
  modifiedPlan?: ResearchPlan;
  sources: ResearchSource[];
  collectedContent: string;
  error?: string;
  quotaCheck?: QuotaCheckResult;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  model?: string;
  isWebSearchEnabled: boolean;
  selectedPageIds?: string[];
  currentStepId?: string;
  stepProgress: Record<string, {
    status: 'idle' | 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }>;
}

export type DeepResearchEvent =
  | { type: 'START_RESEARCH'; query: string; workspaceId: string; userId: string; model?: string; isWebSearchEnabled?: boolean; selectedPageIds?: string[] }
  | { type: 'PROVIDE_CLARIFICATION'; answer: string }
  | { type: 'MODIFY_PLAN'; plan: ResearchPlan }
  | { type: 'SSE_EVENT'; event: any }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

const initialContext: DeepResearchContext = {
  messages: [],
  clarificationRound: 0,
  sources: [],
  collectedContent: '',
  stepProgress: {},
  workspaceId: '',
  userId: '',
  isWebSearchEnabled: false,
};

export const deepResearchMachine = setup({
  types: {
    context: {} as DeepResearchContext,
    events: {} as DeepResearchEvent,
  },
  actions: {
    resetContext: assign(initialContext),
  },
  guards: {
    isQuotaCheck: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'quota_check',
    isQuotaExceeded: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'quota_exceeded',
    isClarificationNeeded: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'clarification_needed',
    isClarificationComplete: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'clarification_complete',
    isPlanGenerated: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'plan_generated',
    isStepStarted: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'step_started',
    isStepProgress: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'step_progress',
    isStepCompleted: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'step_completed',
    isSynthesisStarted: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'synthesis_started',
    isSourcesUpdate: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'sources',
    isChunk: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'chunk',
    isComplete: ({ event }) => 
      event.type === 'SSE_EVENT' && 
      event.event.type === 'complete',
    isError: ({ event }) =>
      event.type === 'SSE_EVENT' &&
      event.event.type === 'error',
    isFatalError: ({ event }) => {
      if (event.type !== 'SSE_EVENT' || event.event.type !== 'error') {
        return false;
      }

      const errorMessage = event.event.data?.error;
      const recoverable = event.event.data?.recoverable;

      if (errorMessage === 'CLARIFICATION_NEEDED') {
        return false;
      }

      return recoverable !== true;
    },
  },
}).createMachine({
  id: 'deepResearch',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        START_RESEARCH: {
          target: 'streaming',
          actions: assign({
            messages: ({ context, event }) => [...context.messages, { role: 'user', content: event.query }],
            workspaceId: ({ event }) => event.workspaceId,
            userId: ({ event }) => event.userId,
            model: ({ event }) => event.model,
            isWebSearchEnabled: ({ event }) => event.isWebSearchEnabled || false,
            selectedPageIds: ({ event }) => event.selectedPageIds,
            clarificationQuestion: () => undefined,
            researchPlan: () => undefined,
            modifiedPlan: () => undefined,
            sources: () => [],
            collectedContent: () => '',
            error: () => undefined,
            quotaCheck: () => undefined,
            currentStepId: () => undefined,
            stepProgress: () => ({}),
            clarificationRound: () => 0,
          }),
        },
      },
    },

    streaming: {
      on: {
        SSE_EVENT: [
          {
            guard: 'isQuotaExceeded',
            target: 'error',
            actions: assign({
              error: ({ event }) => event.event.data?.reason || 'Quota exceeded',
            }),
          },
          {
            guard: 'isQuotaCheck',
            actions: assign({
              quotaCheck: ({ event }) => event.event.data,
            }),
          },
          {
            guard: 'isClarificationNeeded',
            target: 'awaitingClarification',
            actions: assign({
              clarificationQuestion: ({ event }) => event.event.data,
            }),
          },
          {
            guard: 'isClarificationComplete',
            actions: assign({
              clarificationQuestion: () => undefined,
            }),
          },
          {
            guard: 'isPlanGenerated',
            target: 'researching',
            actions: assign({
              researchPlan: ({ event }) => event.event.data,
              modifiedPlan: ({ event }) => event.event.data,
            }),
          },
          {
            guard: 'isFatalError',
            target: 'error',
            actions: assign({
              error: ({ event }) => event.event.data?.error || 'Research failed',
            }),
          },
        ],
      },
    },

    awaitingClarification: {
      on: {
        PROVIDE_CLARIFICATION: {
          target: 'streaming',
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              { role: 'user', content: event.answer },
            ],
            clarificationRound: ({ context }) => context.clarificationRound + 1,
            clarificationQuestion: () => undefined,
          }),
        },
        SSE_EVENT: [
          {
            guard: 'isFatalError',
            target: 'error',
            actions: assign({
              error: ({ event }) => event.event.data?.error || 'Research failed',
            }),
          },
          {
            guard: 'isError',
            actions: () => undefined,
          },
        ],
        CANCEL: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    researching: {
      on: {
        SSE_EVENT: [
          {
            guard: 'isStepStarted',
            actions: assign({
              currentStepId: ({ event }) => event.event.data.stepId,
              stepProgress: ({ context, event }) => ({
                ...context.stepProgress,
                [event.event.data.stepId]: {
                  status: 'running',
                  progress: 0,
                },
              }),
            }),
          },
          {
            guard: 'isStepProgress',
            actions: assign({
              stepProgress: ({ context, event }) => ({
                ...context.stepProgress,
                [event.event.data.stepId]: {
                  status: 'running',
                  progress: event.event.data.progress ?? 0,
                },
              }),
            }),
          },
          {
            guard: 'isStepCompleted',
            actions: assign({
              stepProgress: ({ context, event }) => ({
                ...context.stepProgress,
                [event.event.data.stepId]: {
                  status: 'completed',
                  progress: 100,
                },
              }),
            }),
          },
          {
            guard: 'isSourcesUpdate',
            actions: assign({
              sources: ({ context, event }) => [...context.sources, ...event.event.data],
            }),
          },
          {
            guard: 'isSynthesisStarted',
            target: 'synthesizing',
          },
          {
            guard: 'isChunk',
            target: 'synthesizing',
            actions: assign({
              collectedContent: ({ context, event }) =>
                context.collectedContent + event.event.data,
            }),
          },
          {
            guard: 'isComplete',
            target: 'completed',
          },
          {
            guard: 'isFatalError',
            target: 'error',
            actions: assign({
              error: ({ event }) => event.event.data?.error || 'Research failed',
            }),
          },
        ],
        CANCEL: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    synthesizing: {
      on: {
        SSE_EVENT: [
          {
            guard: 'isChunk',
            actions: assign({
              collectedContent: ({ context, event }) =>
                context.collectedContent + event.event.data,
            }),
          },
          {
            guard: 'isSourcesUpdate',
            actions: assign({
              sources: ({ context, event }) => [...context.sources, ...event.event.data],
            }),
          },
          {
            guard: 'isComplete',
            target: 'completed',
          },
          {
            guard: 'isFatalError',
            target: 'error',
            actions: assign({
              error: ({ event }) => event.event.data?.error || 'Research failed',
            }),
          },
        ],
        CANCEL: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    completed: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
        CANCEL: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
  },
});

