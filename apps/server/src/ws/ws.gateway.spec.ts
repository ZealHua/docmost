import { WsGateway } from './ws.gateway';

describe('WsGateway', () => {
  function createGateway() {
    const tokenService = {
      verifyJwt: jest.fn(),
    };

    const spaceMemberRepo = {
      getUserSpaceIds: jest.fn(),
    };

    const pagePermissionRepo = {
      hasRestrictedPagesInSpace: jest.fn(),
      hasRestrictedAncestor: jest.fn(),
      canUserAccessPage: jest.fn(),
    };

    const gateway = new WsGateway(
      tokenService as any,
      spaceMemberRepo as any,
      pagePermissionRepo as any,
    );

    const emit = jest.fn();
    const exceptEmit = jest.fn();
    const except = jest.fn().mockReturnValue({ emit: exceptEmit });
    const to = jest.fn().mockReturnValue({ emit, except });
    const fetchSockets = jest.fn().mockResolvedValue([]);

    (gateway as any).server = {
      to,
      in: jest.fn().mockReturnValue({ fetchSockets }),
    };

    return {
      gateway,
      pagePermissionRepo,
      serverTo: to,
      serverEmit: emit,
      serverExcept: except,
      serverExceptEmit: exceptEmit,
      fetchSockets,
    };
  }

  it('emits refetch and invalidate events for permission changes', () => {
    const { gateway, serverTo, serverEmit } = createGateway();

    gateway.notifyPagePermissionChanged('space-1', 'page-1');

    expect(serverTo).toHaveBeenCalledTimes(2);
    expect(serverTo).toHaveBeenCalledWith('space-space-1');
    expect(serverEmit).toHaveBeenNthCalledWith(1, 'message', {
      operation: 'refetchRootTreeNodeEvent',
      spaceId: 'space-1',
    });
    expect(serverEmit).toHaveBeenNthCalledWith(2, 'message', {
      operation: 'invalidate',
      spaceId: 'space-1',
      entity: ['pages'],
      id: 'page-1',
    });
  });

  it('invalidates page restriction cache entries for a specific page', () => {
    const { gateway } = createGateway();

    (gateway as any).restrictedAncestorCache.set('page-1', {
      value: true,
      expiresAt: Date.now() + 10_000,
    });
    (gateway as any).userPageAccessCache.set('u1:page-1', {
      value: true,
      expiresAt: Date.now() + 10_000,
    });
    (gateway as any).userPageAccessCache.set('u2:page-2', {
      value: true,
      expiresAt: Date.now() + 10_000,
    });

    gateway.invalidatePageRestrictionCache('page-1');

    expect((gateway as any).restrictedAncestorCache.has('page-1')).toBe(false);
    expect((gateway as any).userPageAccessCache.has('u1:page-1')).toBe(false);
    expect((gateway as any).userPageAccessCache.has('u2:page-2')).toBe(true);
  });

  it('reuses restricted-space cache in handleMessage', async () => {
    const { gateway, pagePermissionRepo } = createGateway();

    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(false);

    const roomEmit = jest.fn();
    const client = {
      id: 'socket-1',
      data: { userId: 'user-1' },
      broadcast: {
        to: jest.fn().mockReturnValue({ emit: roomEmit }),
        emit: jest.fn(),
      },
    };

    const event = {
      operation: 'updateOne',
      entity: ['pages'],
      id: 'page-1',
      spaceId: 'space-1',
      payload: {},
    };

    await gateway.handleMessage(client as any, event);
    await gateway.handleMessage(client as any, event);

    expect(pagePermissionRepo.hasRestrictedPagesInSpace).toHaveBeenCalledTimes(1);
    expect(roomEmit).toHaveBeenCalledTimes(2);
  });

  it('emits comment events without sender exclusion when unrestricted', async () => {
    const { gateway, pagePermissionRepo, serverTo, serverEmit, serverExcept } =
      createGateway();

    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(false);

    await gateway.emitCommentEvent('space-1', 'page-1', {
      operation: 'commentDeleted',
      pageId: 'page-1',
      commentId: 'comment-1',
    });

    expect(serverTo).toHaveBeenCalledWith('space-space-1');
    expect(serverEmit).toHaveBeenCalledWith('message', {
      operation: 'commentDeleted',
      pageId: 'page-1',
      commentId: 'comment-1',
    });
    expect(serverExcept).not.toHaveBeenCalled();
  });

  it('emits comment events with sender exclusion when unrestricted', async () => {
    const {
      gateway,
      pagePermissionRepo,
      serverTo,
      serverExcept,
      serverExceptEmit,
      serverEmit,
    } = createGateway();

    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(false);

    await gateway.emitCommentEvent(
      'space-1',
      'page-1',
      {
        operation: 'commentDeleted',
        pageId: 'page-1',
        commentId: 'comment-1',
      },
      'user-1',
    );

    expect(serverTo).toHaveBeenCalledWith('space-space-1');
    expect(serverExcept).toHaveBeenCalledWith('user-user-1');
    expect(serverExceptEmit).toHaveBeenCalledWith('message', {
      operation: 'commentDeleted',
      pageId: 'page-1',
      commentId: 'comment-1',
    });
    expect(serverEmit).not.toHaveBeenCalled();
  });

  it('broadcasts comment events only to authorized sockets and excludes sender on restricted pages', async () => {
    const { gateway, pagePermissionRepo, fetchSockets } = createGateway();

    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(true);
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(true);
    pagePermissionRepo.canUserAccessPage.mockImplementation(async (userId: string) => {
      if (userId === 'user-2') return true;
      if (userId === 'user-3') return false;
      return true;
    });

    const senderEmit = jest.fn();
    const authorizedEmit = jest.fn();
    const unauthorizedEmit = jest.fn();

    fetchSockets.mockResolvedValue([
      { data: { userId: 'user-1' }, emit: senderEmit },
      { data: { userId: 'user-2' }, emit: authorizedEmit },
      { data: { userId: 'user-3' }, emit: unauthorizedEmit },
    ]);

    await gateway.emitCommentEvent(
      'space-1',
      'page-1',
      {
        operation: 'commentDeleted',
        pageId: 'page-1',
        commentId: 'comment-1',
      },
      'user-1',
    );

    expect(senderEmit).not.toHaveBeenCalled();
    expect(authorizedEmit).toHaveBeenCalledWith('message', {
      operation: 'commentDeleted',
      pageId: 'page-1',
      commentId: 'comment-1',
    });
    expect(unauthorizedEmit).not.toHaveBeenCalled();
  });
});
