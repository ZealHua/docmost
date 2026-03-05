import { ServiceUnavailableException } from '@nestjs/common';
import { ResearchPlan } from './services/planning.service';

jest.mock('@docmost/db/helpers/helpers', () => ({
  isPageEmbeddingsTableExists: jest.fn(),
}), { virtual: true });

jest.mock('@docmost/db/repos/page/page.repo', () => ({
  PageRepo: class {},
}), { virtual: true });

jest.mock('@/mem0/mem0.service', () => ({
  Mem0Service: class {},
}), { virtual: true });

const { AiController } = require('./ai.controller');

describe('AiController deep research endpoints', () => {
  const orchestrator = {
    isConfigured: jest.fn(),
    getProvider: jest.fn(),
  };

  const ragService = {};
  const webSearchService = {};
  const sessionRepo = {};

  const messageRepo = {
    countAssistantMessagesWithApprovalAudit: jest.fn(),
  };

  const researchSessionRepo = {
    countByStatuses: jest.fn(),
  };

  const pageRepo = {};

  const configService = {
    get: jest.fn().mockReturnValue('false'),
  };

  const mem0Service = {};

  const deepResearchService = {
    validatePlanContinuation: jest.fn(),
    rejectPlanContinuation: jest.fn(),
    getSessionAudit: jest.fn(),
  };

  const createController = () => {
    return new AiController(
      orchestrator as any,
      ragService as any,
      webSearchService as any,
      sessionRepo as any,
      messageRepo as any,
      researchSessionRepo as any,
      pageRepo as any,
      configService as any,
      mem0Service as any,
      deepResearchService as any,
    );
  };

  const user = { id: 'user-1' };
  const workspace = { id: 'workspace-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator.isConfigured.mockReturnValue(true);
  });

  it('continueDeepResearch validates continuation and returns ready status', async () => {
    const controller = createController();
    const approvedPlan: ResearchPlan = {
      id: 'plan-1',
      title: 'Edited plan',
      description: 'desc',
      steps: [
        {
          id: 'step-1',
          type: 'search',
          title: 'Search',
          description: 'Find data',
          estimatedDuration: '5m',
          required: true,
        },
      ],
      estimatedSources: 4,
      estimatedTime: '10m',
      estimatedCost: 0.1,
      riskLevel: 'low',
    };

    deepResearchService.validatePlanContinuation.mockResolvedValue({
      researchSessionId: 'research-1',
      status: 'in_progress',
      approvedAt: '2026-03-04T00:00:00.000Z',
      approvedById: 'user-1',
      approvedPlanHash: 'hash-1',
    });

    const response = await controller.continueDeepResearch(
      {
        researchSessionId: 'research-1',
        expectedPlanHash: 'hash-1',
        approvedPlan,
      },
      user,
      workspace,
    );

    expect(deepResearchService.validatePlanContinuation).toHaveBeenCalledWith({
      researchSessionId: 'research-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      expectedPlanHash: 'hash-1',
      approvedPlan,
    });

    expect(response).toEqual({
      status: 'ready',
      audit: {
        researchSessionId: 'research-1',
        status: 'in_progress',
        approvedAt: '2026-03-04T00:00:00.000Z',
        approvedById: 'user-1',
        approvedPlanHash: 'hash-1',
      },
    });
  });

  it('rejectDeepResearch cancels pending session', async () => {
    const controller = createController();

    const response = await controller.rejectDeepResearch(
      { researchSessionId: 'research-1' },
      user,
      workspace,
    );

    expect(deepResearchService.rejectPlanContinuation).toHaveBeenCalledWith({
      researchSessionId: 'research-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    expect(response).toEqual({ status: 'cancelled' });
  });

  it('getDeepResearchAuditStats aggregates message and session stats', async () => {
    const controller = createController();

    messageRepo.countAssistantMessagesWithApprovalAudit.mockResolvedValue(12);
    researchSessionRepo.countByStatuses.mockResolvedValue({
      awaitingApproval: 1,
      approved: 5,
      completed: 4,
      cancelled: 2,
    });

    const response = await controller.getDeepResearchAuditStats(user, workspace);

    expect(messageRepo.countAssistantMessagesWithApprovalAudit).toHaveBeenCalledWith('workspace-1', 'user-1');
    expect(researchSessionRepo.countByStatuses).toHaveBeenCalledWith('workspace-1', 'user-1');
    expect(response).toEqual({
      assistantMessagesWithApprovalAudit: 12,
      sessions: {
        awaitingApproval: 1,
        approved: 5,
        completed: 4,
        cancelled: 2,
      },
    });
  });

  it('throws ServiceUnavailableException when AI is not configured', async () => {
    orchestrator.isConfigured.mockReturnValue(false);
    const controller = createController();

    await expect(
      controller.continueDeepResearch(
        {
          researchSessionId: 'research-1',
          expectedPlanHash: 'hash-1',
        },
        user,
        workspace,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deepResearchService.validatePlanContinuation).not.toHaveBeenCalled();
  });
});
