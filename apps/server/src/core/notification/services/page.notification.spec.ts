import { PageNotificationService } from './page.notification';
import { NotificationType } from '../notification.constants';

jest.mock(
  '@docmost/transactional/emails/page-mention-email',
  () => ({ PageMentionEmail: jest.fn() }),
  { virtual: true },
);

jest.mock(
  '@docmost/transactional/emails/page-permission-email',
  () => ({ PagePermissionEmail: jest.fn() }),
  { virtual: true },
);

describe('PageNotificationService', () => {
  function createService() {
    const notificationService = {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };

    const spaceMemberRepo = {
      getUserIdsWithSpaceAccess: jest.fn(),
    };

    const pagePermissionRepo = {
      hasRestrictedAncestor: jest.fn(),
      canUserAccessPage: jest.fn(),
    };

    const service = new PageNotificationService(
      {} as any,
      notificationService as any,
      spaceMemberRepo as any,
      pagePermissionRepo as any,
    );

    (service as any).getPageContext = jest.fn().mockResolvedValue({
      actor: { id: 'actor-1', name: 'Alice' },
      pageTitle: 'Roadmap',
      basePageUrl: 'https://app.local/s/space/p/page-slug',
    });

    return {
      service,
      notificationService,
      spaceMemberRepo,
      pagePermissionRepo,
    };
  }

  it('creates permission-granted notifications only for users with access', async () => {
    const { service, notificationService, spaceMemberRepo, pagePermissionRepo } =
      createService();

    spaceMemberRepo.getUserIdsWithSpaceAccess.mockResolvedValue(
      new Set(['u1', 'u2']),
    );
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(true);
    pagePermissionRepo.canUserAccessPage.mockImplementation(
      async (userId: string) => userId === 'u1',
    );

    await service.processPagePermissionGranted(
      {
        recipientUserIds: ['u1', 'u2', 'actor-1'],
        actorId: 'actor-1',
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        role: 'writer',
      },
      'https://app.local',
    );

    expect(notificationService.create).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: NotificationType.PAGE_PERMISSION_GRANTED,
        data: { role: 'writer' },
      }),
    );
    expect(notificationService.queueEmail).toHaveBeenCalledTimes(1);
  });

  it('creates notifications for all space-access users when page has no restrictions', async () => {
    const { service, notificationService, spaceMemberRepo, pagePermissionRepo } =
      createService();

    spaceMemberRepo.getUserIdsWithSpaceAccess.mockResolvedValue(
      new Set(['u1', 'u2']),
    );
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(false);

    await service.processPagePermissionGranted(
      {
        recipientUserIds: ['u1', 'u2'],
        actorId: 'actor-1',
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        role: 'reader',
      },
      'https://app.local',
    );

    expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
    expect(notificationService.create).toHaveBeenCalledTimes(2);
  });
});
