jest.mock(
  '../../collaboration/collaboration.util',
  () => ({
    jsonToNode: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '../../common/helpers/prosemirror/utils',
  () => ({
    getAttachmentIds: jest.fn(),
    getProsemirrorContent: jest.fn(),
    isAttachmentNode: jest.fn(),
    removeMarkTypeFromDoc: jest.fn(),
  }),
  { virtual: true },
);

import { NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

describe('ShareService', () => {
  function createService() {
    const shareRepo = {
      findById: jest.fn(),
      findByPageId: jest.fn(),
      insertShare: jest.fn(),
      updateShare: jest.fn(),
    };

    const pageRepo = {
      getPageAndDescendants: jest.fn(),
      getPageAndDescendantsExcludingRestricted: jest.fn(),
      findById: jest.fn(),
    };

    const pagePermissionRepo = {
      hasRestrictedAncestor: jest.fn(),
    };

    const service = new ShareService(
      shareRepo as any,
      pageRepo as any,
      pagePermissionRepo as any,
      {} as any,
      {} as any,
    );

    return { service, shareRepo, pageRepo, pagePermissionRepo };
  }

  it('uses restricted-subtree repo query when includeSubPages is true', async () => {
    const { service, shareRepo, pageRepo, pagePermissionRepo } = createService();

    shareRepo.findById.mockResolvedValue({
      id: 's1',
      workspaceId: 'w1',
      pageId: 'p1',
      includeSubPages: true,
    });
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(false);
    pageRepo.getPageAndDescendantsExcludingRestricted.mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
    ]);

    const result = await service.getShareTree('s1', 'w1');

    expect(pageRepo.getPageAndDescendantsExcludingRestricted).toHaveBeenCalledWith(
      'p1',
      { includeContent: false },
    );
    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledTimes(1);
    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledWith('p1');
    expect(pageRepo.getPageAndDescendants).not.toHaveBeenCalled();
    expect(result.pageTree).toEqual([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('returns empty tree when includeSubPages is false', async () => {
    const { service, shareRepo, pageRepo, pagePermissionRepo } = createService();

    shareRepo.findById.mockResolvedValue({
      id: 's1',
      workspaceId: 'w1',
      pageId: 'p1',
      includeSubPages: false,
    });
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(false);

    const result = await service.getShareTree('s1', 'w1');

    expect(pageRepo.getPageAndDescendantsExcludingRestricted).not.toHaveBeenCalled();
    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledTimes(1);
    expect(result.pageTree).toEqual([]);
  });

  it('throws when root shared page is restricted', async () => {
    const { service, shareRepo, pagePermissionRepo } = createService();

    shareRepo.findById.mockResolvedValue({
      id: 's1',
      workspaceId: 'w1',
      pageId: 'p1',
      includeSubPages: true,
    });
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(true);

    await expect(service.getShareTree('s1', 'w1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledTimes(1);
    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledWith('p1');
  });
});