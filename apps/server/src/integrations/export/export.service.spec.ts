jest.mock(
  '@docmost/editor-ext',
  () => ({
    htmlToMarkdown: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '../../collaboration/collaboration.util',
  () => ({
    jsonToHtml: jest.fn(),
    jsonToNode: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'src/collaboration/collaboration.util',
  () => ({
    jsonToHtml: jest.fn(),
    jsonToNode: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '../../common/helpers/prosemirror/utils',
  () => ({
    getAttachmentIds: jest.fn(),
    getProsemirrorContent: jest.fn((content) => content),
  }),
  { virtual: true },
);

import { ExportService } from './export.service';
import { ExportFormat } from './dto/export-dto';

describe('ExportService', () => {
  function createService() {
    const pageRepo = {
      getPageAndDescendants: jest.fn(),
      findById: jest.fn(),
      withSpace: jest.fn(),
    };

    const pagePermissionRepo = {
      filterAccessiblePageIds: jest.fn(),
    };

    const service = new ExportService(
      pageRepo as any,
      pagePermissionRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, pageRepo, pagePermissionRepo };
  }

  function makePage(id: string, parentPageId: string | null = null) {
    return {
      id,
      slugId: `${id}-slug`,
      title: id,
      icon: null,
      position: 'a0',
      content: { type: 'doc', content: [] },
      parentPageId,
      spaceId: 'space-1',
      workspaceId: 'workspace-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  it('throws when requested root page is not accessible after filtering', async () => {
    const { service, pageRepo, pagePermissionRepo } = createService();

    pageRepo.getPageAndDescendants.mockResolvedValue([
      makePage('root', null),
      makePage('child', 'root'),
    ]);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['child']);

    await expect(
      service.exportPages(
        'root',
        ExportFormat.HTML,
        false,
        true,
        'user-1',
      ),
    ).rejects.toThrow('No pages to export');

    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledTimes(1);
  });

  it('exports only accessible descendants when includeChildren is enabled', async () => {
    const { service, pageRepo, pagePermissionRepo } = createService();

    pageRepo.getPageAndDescendants.mockResolvedValue([
      makePage('root', null),
      makePage('child', 'root'),
    ]);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['root']);

    const zipPagesSpy = jest
      .spyOn(service, 'zipPages')
      .mockResolvedValue(undefined);

    const zipStream = await service.exportPages(
      'root',
      ExportFormat.HTML,
      false,
      true,
      'user-1',
    );

    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['root', 'child'],
      userId: 'user-1',
      spaceId: 'space-1',
    });
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledTimes(1);
    expect(zipPagesSpy).toHaveBeenCalledTimes(1);
    const treeArg = zipPagesSpy.mock.calls[0][0] as Record<string, any[]>;
    expect(treeArg.null).toHaveLength(1);
    expect(treeArg.root ?? []).toHaveLength(0);
    expect(zipStream).toBeDefined();
  });
});