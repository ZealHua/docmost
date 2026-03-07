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
  const sessionRepo = {
    findById: jest.fn(),
    updateSelectedPageIds: jest.fn(),
    touch: jest.fn(),
  };

  const messageRepo = {
    countAssistantMessagesWithApprovalAudit: jest.fn(),
  };

  const researchSessionRepo = {
    countByStatuses: jest.fn(),
  };

  const pageRepo = {
    findByIds: jest.fn(),
  };

  const spaceMemberRepo = {
    getUserSpaceIds: jest.fn(),
  };

  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn(),
  };

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
      spaceMemberRepo as any,
      pagePermissionRepo as any,
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

  it('sanitizes selectedPageIds before RAG retrieval and persistence', async () => {
    const controller = createController();
    const streamChat = jest.fn(async (_messages, _chunks, onChunk, onDone) => {
      onChunk('hello');
      await onDone();
    });

    orchestrator.getProvider.mockReturnValue({
      streamChat,
    });

    (ragService as any).retrieveSelectedPages = jest
      .fn()
      .mockResolvedValue([]);
    (webSearchService as any).rewriteQuery = jest
      .fn()
      .mockResolvedValue('NO_SEARCH');
    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-1']);
    pageRepo.findByIds.mockResolvedValue([
      { id: 'page-1', workspaceId: 'workspace-1', spaceId: 'space-1' },
      { id: 'page-2', workspaceId: 'workspace-1', spaceId: 'space-2' },
      { id: 'page-4', workspaceId: 'workspace-2', spaceId: 'space-1' },
    ]);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['page-1']);

    sessionRepo.findById.mockResolvedValue({
      id: 'session-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
    (messageRepo as any).create = jest.fn().mockResolvedValue(undefined);
    sessionRepo.updateSelectedPageIds.mockResolvedValue(undefined);
    sessionRepo.touch.mockResolvedValue(undefined);
    (mem0Service as any).isEnabled = jest.fn().mockReturnValue(false);

    const responseRaw = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    await controller.streamChat(
      {
        messages: [{ role: 'user', content: 'hello' }],
        sessionId: 'session-1',
        selectedPageIds: ['page-1', 'page-2', 'page-3', 'page-4', 'page-1'],
        isWebSearchEnabled: false,
      } as any,
      { raw: { signal: undefined } } as any,
      {
        hijack: jest.fn(),
        raw: responseRaw,
      } as any,
      { id: 'user-1' } as any,
      { id: 'workspace-1', settings: {} } as any,
    );

    expect(spaceMemberRepo.getUserSpaceIds).toHaveBeenCalledWith('user-1');
    expect(pageRepo.findByIds).toHaveBeenCalledWith(['page-1', 'page-2', 'page-3', 'page-4']);
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['page-1'],
      userId: 'user-1',
    });
    expect((ragService as any).retrieveSelectedPages).toHaveBeenCalledWith(
      ['page-1'],
      'workspace-1',
    );
    expect(sessionRepo.updateSelectedPageIds).toHaveBeenCalledWith('session-1', ['page-1']);
  });

  it('does not call selected-page retrieval when no accessible selected pages remain', async () => {
    const controller = createController();
    const streamChat = jest.fn(async (_messages, _chunks, _onChunk, onDone) => {
      await onDone();
    });

    orchestrator.getProvider.mockReturnValue({
      streamChat,
    });

    (ragService as any).retrieveSelectedPages = jest
      .fn()
      .mockResolvedValue([]);
    (webSearchService as any).rewriteQuery = jest
      .fn()
      .mockResolvedValue('NO_SEARCH');
    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-1']);
    pageRepo.findByIds.mockResolvedValue([
      { id: 'page-2', workspaceId: 'workspace-1', spaceId: 'space-2' },
    ]);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue([]);

    sessionRepo.findById.mockResolvedValue({
      id: 'session-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
    (messageRepo as any).create = jest.fn().mockResolvedValue(undefined);
    sessionRepo.updateSelectedPageIds.mockResolvedValue(undefined);
    sessionRepo.touch.mockResolvedValue(undefined);
    (mem0Service as any).isEnabled = jest.fn().mockReturnValue(false);

    await controller.streamChat(
      {
        messages: [{ role: 'user', content: 'hello' }],
        sessionId: 'session-1',
        selectedPageIds: ['page-2'],
        isWebSearchEnabled: false,
      } as any,
      { raw: { signal: undefined } } as any,
      {
        hijack: jest.fn(),
        raw: {
          setHeader: jest.fn(),
          flushHeaders: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
        },
      } as any,
      { id: 'user-1' } as any,
      { id: 'workspace-1', settings: {} } as any,
    );

    expect((ragService as any).retrieveSelectedPages).not.toHaveBeenCalled();
    expect(sessionRepo.updateSelectedPageIds).not.toHaveBeenCalled();
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
