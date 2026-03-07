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
    const to = jest.fn().mockReturnValue({ emit });

    (gateway as any).server = {
      to,
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    };

    return {
      gateway,
      pagePermissionRepo,
      serverTo: to,
      serverEmit: emit,
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
});
