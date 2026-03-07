jest.mock(
  '@docmost/editor-ext',
  () => ({
    markdownToHtml: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '../../../common/helpers/prosemirror/utils',
  () => ({
    createYdocFromJson: jest.fn(),
    getAttachmentIds: jest.fn(),
    getProsemirrorContent: jest.fn(),
    isAttachmentNode: jest.fn(),
    removeMarkTypeFromDoc: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'src/collaboration/collaboration.util',
  () => ({
    htmlToJson: jest.fn(),
    jsonToNode: jest.fn(),
    jsonToText: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '../../../collaboration/collaboration.gateway',
  () => ({
    CollaborationGateway: class {
      handleYjsEvent = jest.fn();
    },
  }),
  { virtual: true },
);

import { PageService } from './page.service';
import { BadRequestException } from '@nestjs/common';
import { jsonToNode } from 'src/collaboration/collaboration.util';

describe('PageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    const pagePermissionRepo = {
      filterAccessiblePageIds: jest.fn(),
      hasRestrictedPagesInSpace: jest.fn(),
      canUserEditPage: jest.fn(),
    };

    const wsGateway = {
      invalidateSpaceRestrictionCache: jest.fn(),
      invalidatePageRestrictionCache: jest.fn(),
      notifyPagePermissionChanged: jest.fn(),
    };

    const collaborationGateway = {
      handleYjsEvent: jest.fn(),
    };

    const service = new PageService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      collaborationGateway as any,
      {} as any,
      pagePermissionRepo as any,
      {} as any,
      wsGateway as any,
    );

    return { service, pagePermissionRepo, collaborationGateway };
  }

  it('returns visible pages with canEdit=true when no restrictions exist in space', async () => {
    const { service, pagePermissionRepo } = createService();

    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['p1']);
    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(false);

    const result = await (service as any).applyPageAccessFilter(
      [{ id: 'p1', title: 'Visible' }, { id: 'p2', title: 'Hidden' }],
      'user-1',
      'space-1',
    );

    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['p1', 'p2'],
      userId: 'user-1',
      spaceId: 'space-1',
    });
    expect(pagePermissionRepo.canUserEditPage).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'p1', title: 'Visible', canEdit: true }]);
  });

  it('computes canEdit per page when restrictions exist in space', async () => {
    const { service, pagePermissionRepo } = createService();

    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['p1', 'p2']);
    pagePermissionRepo.hasRestrictedPagesInSpace.mockResolvedValue(true);
    pagePermissionRepo.canUserEditPage.mockImplementation(
      async (_userId: string, pageId: string) => ({
        hasAnyRestriction: true,
        canAccess: true,
        canEdit: pageId === 'p2',
      }),
    );

    const result = await (service as any).applyPageAccessFilter(
      [{ id: 'p1', title: 'Reader' }, { id: 'p2', title: 'Writer' }],
      'user-1',
      'space-1',
    );

    expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: 'p1', title: 'Reader', canEdit: false },
      { id: 'p2', title: 'Writer', canEdit: true },
    ]);
  });

  it('throws BadRequestException for invalid content payload during updatePageContent', async () => {
    const { service, collaborationGateway } = createService();
    (jsonToNode as jest.Mock).mockImplementation(() => {
      throw new Error('invalid prosemirror');
    });

    await expect(
      service.updatePageContent(
        'page-1',
        { bad: 'payload' },
        'append',
        'json',
        { id: 'user-1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
  });

  it('sends prepend operation payload to collaboration gateway', async () => {
    const { service, collaborationGateway } = createService();
    const prosemirrorJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    };
    const user = { id: 'user-1' } as any;

    (jsonToNode as jest.Mock).mockReturnValue(undefined);

    await service.updatePageContent(
      'page-1',
      prosemirrorJson,
      'prepend',
      'json',
      user,
    );

    expect(collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'updatePageContent',
      'page.page-1',
      {
        operation: 'prepend',
        prosemirrorJson,
        user,
      },
    );
  });
});
