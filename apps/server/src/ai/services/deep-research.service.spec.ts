import { createHash } from 'crypto';
import { DeepResearchService } from './deep-research.service';
import { ResearchPlan } from './planning.service';

function makePlan(overrides: Partial<ResearchPlan> = {}): ResearchPlan {
  return {
    id: 'plan-1',
    title: 'Test Plan',
    description: 'Plan description',
    steps: [
      {
        id: 'step-1',
        type: 'search',
        title: 'Search',
        description: 'Find sources',
        query: 'test query',
        estimatedDuration: '5m',
        required: true,
      },
    ],
    estimatedSources: 5,
    estimatedTime: '10m',
    estimatedCost: 0.12,
    riskLevel: 'low',
    ...overrides,
  };
}

function makeSession(overrides: Record<string, any> = {}) {
  const now = new Date('2026-03-04T00:00:00.000Z');
  return {
    id: 'research-session-1',
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    query: 'What is the status?',
    plan: makePlan(),
    finalReport: undefined,
    webSearchesCount: 0,
    crawlUrlsCount: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    estimatedCost: 0,
    status: 'awaiting_approval',
    errorMessage: undefined,
    approvedAt: undefined,
    approvedById: undefined,
    approvedPlanHash: undefined,
    startedAt: now,
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('DeepResearchService', () => {
  const configService = {
    get: jest.fn().mockReturnValue('false'),
  };

  const quotaService = {
    checkQuota: jest.fn(),
    incrementUsage: jest.fn(),
  };

  const clarificationService = {
    needsClarification: jest.fn(),
    generateClarification: jest.fn(),
  };

  const planningService = {
    generatePlan: jest.fn(),
    validatePlan: jest.fn(),
  };

  const jinaCrawlerService = {
    crawlUrl: jest.fn(),
  };

  const contentExtractorService = {
    extractContent: jest.fn(),
  };

  const webSearchService = {
    search: jest.fn(),
  };

  const tavilyResearchService = {
    research: jest.fn(),
  };

  const orchestrator = {
    getProvider: jest.fn(),
  };

  const researchSessionRepo = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createOperation: jest.fn(),
    getTotalCost: jest.fn(),
  };

  const aiSessionRepo = {
    findById: jest.fn(),
    updateTitle: jest.fn(),
  };

  const createService = () => {
    return new DeepResearchService(
      configService as any,
      quotaService as any,
      clarificationService as any,
      planningService as any,
      jinaCrawlerService as any,
      contentExtractorService as any,
      webSearchService as any,
      tavilyResearchService as any,
      orchestrator as any,
      researchSessionRepo as any,
      aiSessionRepo as any,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates continuation with edited plan and updates session audit fields', async () => {
    const service = createService();
    const session = makeSession();
    const editedPlan = makePlan({ title: 'Edited Plan Title' });
    const expectedPlanHash = createHash('sha256').update(JSON.stringify(editedPlan)).digest('hex');

    researchSessionRepo.findById.mockResolvedValue(session);
    planningService.validatePlan.mockResolvedValue({
      isSufficient: true,
      recommendations: [],
    });

    const result = await service.validatePlanContinuation({
      researchSessionId: session.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
      expectedPlanHash,
      approvedPlan: editedPlan,
    });

    expect(researchSessionRepo.update).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        plan: editedPlan,
        status: 'in_progress',
        approvedById: session.userId,
        approvedPlanHash: expectedPlanHash,
        approvedAt: expect.any(Date),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        researchSessionId: session.id,
        status: 'in_progress',
        approvedById: session.userId,
        approvedPlanHash: expectedPlanHash,
      }),
    );
  });

  it('rejects continuation when the expected plan hash is stale', async () => {
    const service = createService();
    const session = makeSession();

    researchSessionRepo.findById.mockResolvedValue(session);

    await expect(
      service.validatePlanContinuation({
        researchSessionId: session.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
        expectedPlanHash: 'stale-hash',
      }),
    ).rejects.toThrow('Plan has changed since it was shown. Please review the latest plan before approving.');

    expect(planningService.validatePlan).not.toHaveBeenCalled();
    expect(researchSessionRepo.update).not.toHaveBeenCalled();
  });

  it('cancels awaiting-approval session when plan is rejected', async () => {
    const service = createService();
    const session = makeSession();

    researchSessionRepo.findById.mockResolvedValue(session);

    await service.rejectPlanContinuation({
      researchSessionId: session.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
    });

    expect(researchSessionRepo.update).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        status: 'cancelled',
        errorMessage: 'Plan rejected by user',
        completedAt: expect.any(Date),
      }),
    );
  });
});
