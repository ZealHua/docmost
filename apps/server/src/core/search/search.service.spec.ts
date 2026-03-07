import { SearchService } from './search.service';

describe('SearchService', () => {
  type QueryBuilder = {
    selectFrom: jest.Mock;
    innerJoin: jest.Mock;
    select: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
    execute: jest.Mock;
  };

  function createPageQueryBuilder(result: any[]): QueryBuilder {
    const qb = {
      selectFrom: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(result),
    };

    return qb;
  }

  function createService(pageResults: any[] = []) {
    const pageQb = createPageQueryBuilder(pageResults);

    const db = {
      selectFrom: jest.fn().mockImplementation((table: string) => {
        if (table === 'pages') {
          return pageQb;
        }

        return {
          selectFrom: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };
      }),
    };

    const pageRepo = {};
    const shareRepo = {};
    const spaceMemberRepo = {
      getUserSpaceIds: jest.fn().mockResolvedValue([]),
    };
    const pagePermissionRepo = {
      filterAccessiblePageIds: jest.fn().mockResolvedValue([]),
    };

    const service = new SearchService(
      db as any,
      pageRepo as any,
      shareRepo as any,
      spaceMemberRepo as any,
      pagePermissionRepo as any,
    );

    return {
      service,
      db,
      pageQb,
      spaceMemberRepo,
      pagePermissionRepo,
    };
  }

  it('returns cross-space page suggestions filtered by membership and page access', async () => {
    const pageRows = [
      {
        id: 'p-a',
        slugId: 'slug-a',
        title: 'Alpha',
        icon: '📄',
        spaceId: 'space-a',
        spaceSlug: 'space-a',
      },
      {
        id: 'p-b',
        slugId: 'slug-b',
        title: 'Beta',
        icon: null,
        spaceId: 'space-b',
        spaceSlug: 'space-b',
      },
    ];
    const { service, pageQb, spaceMemberRepo, pagePermissionRepo } =
      createService(pageRows);

    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-a', 'space-b']);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['p-b']);

    const result = await service.searchSuggestions(
      {
        query: 'a',
        includePages: true,
        includeUsers: false,
        includeGroups: false,
        limit: 10,
      },
      'user-1',
      'workspace-1',
    );

    expect(spaceMemberRepo.getUserSpaceIds).toHaveBeenCalledWith('user-1');
    expect(pageQb.where).toHaveBeenCalledWith('spaceId', 'in', [
      'space-a',
      'space-b',
    ]);
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['p-a', 'p-b'],
      userId: 'user-1',
    });
    expect(result.pages).toEqual([pageRows[1]]);
  });

  it('applies explicit spaceId only when user is a member and forwards spaceId to permission filter', async () => {
    const pageRows = [
      {
        id: 'p-a',
        slugId: 'slug-a',
        title: 'Alpha',
        icon: '📄',
        spaceId: 'space-a',
        spaceSlug: 'space-a',
      },
    ];
    const { service, pageQb, spaceMemberRepo, pagePermissionRepo } =
      createService(pageRows);

    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-a']);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['p-a']);

    const result = await service.searchSuggestions(
      {
        query: 'a',
        includePages: true,
        includeUsers: false,
        includeGroups: false,
        spaceId: 'space-a',
      },
      'user-1',
      'workspace-1',
    );

    expect(pageQb.where).toHaveBeenCalledWith('spaceId', '=', 'space-a');
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['p-a'],
      userId: 'user-1',
      spaceId: 'space-a',
    });
    expect(result.pages).toEqual(pageRows);
  });

  it('returns no page suggestions when explicit spaceId is not accessible', async () => {
    const { service, pageQb, spaceMemberRepo, pagePermissionRepo } =
      createService([
        {
          id: 'p-a',
          slugId: 'slug-a',
          title: 'Alpha',
          icon: '📄',
          spaceId: 'space-a',
          spaceSlug: 'space-a',
        },
      ]);

    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-b']);

    const result = await service.searchSuggestions(
      {
        query: 'a',
        includePages: true,
        includeUsers: false,
        includeGroups: false,
        spaceId: 'space-a',
      },
      'user-1',
      'workspace-1',
    );

    expect(pageQb.execute).not.toHaveBeenCalled();
    expect(pagePermissionRepo.filterAccessiblePageIds).not.toHaveBeenCalled();
    expect(result.pages).toEqual([]);
  });

  it('includes target spaceSlug in returned page suggestions', async () => {
    const pageRows = [
      {
        id: 'p-a',
        slugId: 'slug-a',
        title: 'Alpha',
        icon: '📄',
        spaceId: 'space-a',
        spaceSlug: 'engineering',
      },
    ];
    const { service, spaceMemberRepo, pagePermissionRepo } =
      createService(pageRows);

    spaceMemberRepo.getUserSpaceIds.mockResolvedValue(['space-a']);
    pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['p-a']);

    const result = await service.searchSuggestions(
      {
        query: 'alp',
        includePages: true,
        includeUsers: false,
        includeGroups: false,
      },
      'user-1',
      'workspace-1',
    );

    expect(result.pages).toHaveLength(1);
    expect(result.pages?.[0]).toEqual(
      expect.objectContaining({
        id: 'p-a',
        slugId: 'slug-a',
        spaceSlug: 'engineering',
      }),
    );
  });
});
