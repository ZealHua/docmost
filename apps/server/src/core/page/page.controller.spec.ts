jest.mock('./services/page.service', () => ({
  PageService: class {},
}));

import { PageController } from './page.controller';
import { SpaceCaslAction, SpaceCaslSubject } from '../casl/interfaces/space-ability.type';
import { jsonToHtml, jsonToMarkdown } from '../../collaboration/collaboration.util';

jest.mock('../../collaboration/collaboration.util', () => ({
  jsonToHtml: jest.fn(),
  jsonToMarkdown: jest.fn(),
}));

describe('PageController', () => {
  let controller: PageController;
  let pageService: any;
  let pageRepo: any;
  let pageAccessService: any;
  let spaceAbility: any;

  beforeEach(() => {
    pageService = {
      create: jest.fn(),
      update: jest.fn(),
    };

    pageRepo = {
      findById: jest.fn(),
    };

    pageAccessService = {
      validateCanViewWithPermissions: jest.fn(),
      validateCanEdit: jest.fn(),
    };

    spaceAbility = {
      createForUser: jest.fn(),
    };

    controller = new PageController(
      pageService,
      pageRepo,
      {} as any,
      spaceAbility,
      pageAccessService,
    );

    (jsonToMarkdown as jest.Mock).mockReset();
    (jsonToHtml as jest.Mock).mockReset();
  });

  it('converts getPage response content when format=markdown', async () => {
    const page = {
      id: 'page-1',
      content: { type: 'doc', content: [] },
    };

    pageRepo.findById.mockResolvedValue(page);
    pageAccessService.validateCanViewWithPermissions.mockResolvedValue({
      canEdit: true,
      hasRestriction: false,
    });
    (jsonToMarkdown as jest.Mock).mockReturnValue('markdown-output');

    const result = await controller.getPage(
      { pageId: 'page-1', format: 'markdown' } as any,
      { id: 'user-1' } as any,
    );

    expect(jsonToMarkdown).toHaveBeenCalledWith(page.content);
    expect(result.content).toBe('markdown-output');
    expect(result.permissions).toEqual({ canEdit: true, hasRestriction: false });
  });

  it('converts create response content when format=markdown', async () => {
    spaceAbility.createForUser.mockResolvedValue({
      cannot: (action: SpaceCaslAction, subject: SpaceCaslSubject) =>
        action === SpaceCaslAction.Create && subject === SpaceCaslSubject.Page
          ? false
          : false,
    });

    pageService.create.mockResolvedValue({
      id: 'page-1',
      content: { type: 'doc', content: [] },
    });
    (jsonToMarkdown as jest.Mock).mockReturnValue('created-markdown');

    const result = await controller.create(
      { spaceId: 'space-1', format: 'markdown' } as any,
      { id: 'user-1' } as any,
      { id: 'workspace-1' } as any,
    );

    expect(pageService.create).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
      expect.objectContaining({ format: 'markdown' }),
    );
    expect(result.content).toBe('created-markdown');
  });

  it('converts update response content when format=html', async () => {
    pageRepo.findById.mockResolvedValue({
      id: 'page-1',
      contributorIds: [],
    });
    pageAccessService.validateCanEdit.mockResolvedValue(undefined);
    pageService.update.mockResolvedValue({
      id: 'page-1',
      content: { type: 'doc', content: [] },
    });
    (jsonToHtml as jest.Mock).mockReturnValue('<p>updated</p>');

    const user = { id: 'user-1' } as any;
    const result = await controller.update(
      {
        pageId: 'page-1',
        format: 'html',
        operation: 'prepend',
        content: { type: 'doc', content: [] },
      } as any,
      user,
    );

    expect(pageService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-1' }),
      expect.objectContaining({ operation: 'prepend', format: 'html' }),
      user,
    );
    expect(jsonToHtml).toHaveBeenCalled();
    expect(result.content).toBe('<p>updated</p>');
  });

  it('smoke flow: create markdown, update prepend, then get html', async () => {
    const user = { id: 'user-1' } as any;

    spaceAbility.createForUser.mockResolvedValue({
      cannot: () => false,
    });

    pageService.create.mockResolvedValue({
      id: 'page-1',
      content: { type: 'doc', content: [] },
    });

    pageRepo.findById
      .mockResolvedValueOnce({ id: 'page-1', contributorIds: [] })
      .mockResolvedValueOnce({ id: 'page-1', content: { type: 'doc', content: [] } });

    pageAccessService.validateCanEdit.mockResolvedValue(undefined);
    pageAccessService.validateCanViewWithPermissions.mockResolvedValue({
      canEdit: true,
      hasRestriction: false,
    });

    pageService.update.mockResolvedValue({
      id: 'page-1',
      content: { type: 'doc', content: [] },
    });

    (jsonToMarkdown as jest.Mock).mockReturnValue('created-markdown');
    (jsonToHtml as jest.Mock)
      .mockReturnValueOnce('<p>updated-html</p>')
      .mockReturnValueOnce('<p>fetched-html</p>');

    const created = await controller.create(
      {
        spaceId: 'space-1',
        content: '# Hello',
        format: 'markdown',
      } as any,
      user,
      { id: 'workspace-1' } as any,
    );

    const updated = await controller.update(
      {
        pageId: 'page-1',
        content: '<p>Prefix</p>',
        operation: 'prepend',
        format: 'html',
      } as any,
      user,
    );

    const fetched = await controller.getPage(
      {
        pageId: 'page-1',
        format: 'html',
      } as any,
      user,
    );

    expect(created.content).toBe('created-markdown');
    expect(pageService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-1' }),
      expect.objectContaining({ operation: 'prepend', format: 'html' }),
      user,
    );
    expect(updated.content).toBe('<p>updated-html</p>');
    expect(fetched.content).toBe('<p>fetched-html</p>');
    expect(fetched.permissions).toEqual({ canEdit: true, hasRestriction: false });
  });
});
