import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageAccess,
  InsertablePagePermission,
  PageAccess,
  PagePermission,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { sql } from 'kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { PagePermissionMember } from './types/page-permission.types';

@Injectable()
export class PagePermissionRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
  ) {}

  async findPageAccessByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageAccess | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pageAccess')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async insertPageAccess(
    data: InsertablePageAccess,
    trx?: KyselyTransaction,
  ): Promise<PageAccess> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageAccess')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async deletePageAccess(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('pageAccess').where('pageId', '=', pageId).execute();
  }

  async insertPagePermission(
    data: InsertablePagePermission,
    trx?: KyselyTransaction,
  ): Promise<PagePermission> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pagePermissions')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async insertPagePermissions(
    permissions: InsertablePagePermission[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (permissions.length === 0) return;

    const db = dbOrTx(this.db, trx);
    await db.insertInto('pagePermissions').values(permissions).execute();
  }

  async findPagePermissionByUserId(
    pageAccessId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<PagePermission | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageAccessId', '=', pageAccessId)
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async findPagePermissionByGroupId(
    pageAccessId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ): Promise<PagePermission | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageAccessId', '=', pageAccessId)
      .where('groupId', '=', groupId)
      .executeTakeFirst();
  }

  async deletePagePermissionByUserId(
    pageAccessId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('userId', '=', userId)
      .execute();
  }

  async deletePagePermissionByGroupId(
    pageAccessId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('groupId', '=', groupId)
      .execute();
  }

  async updatePagePermissionRole(
    pageAccessId: string,
    role: string,
    opts: { userId?: string; groupId?: string },
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    let query = db
      .updateTable('pagePermissions')
      .set({ role, updatedAt: new Date() })
      .where('pageAccessId', '=', pageAccessId);

    if (opts.userId) {
      query = query.where('userId', '=', opts.userId);
    } else if (opts.groupId) {
      query = query.where('groupId', '=', opts.groupId);
    }

    await query.execute();
  }

  async countWritersByPageAccessId(
    pageAccessId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<number> {
    const db = dbOrTx(this.db, opts?.trx);

    const result = await db
      .selectFrom('pagePermissions')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('pageAccessId', '=', pageAccessId)
      .where('role', '=', 'writer')
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async getPagePermissionsPaginated(
    pageAccessId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<PagePermissionMember>> {
    let baseQuery = this.db
      .selectFrom('pagePermissions')
      .leftJoin('users', 'users.id', 'pagePermissions.userId')
      .leftJoin('groups', 'groups.id', 'pagePermissions.groupId')
      .select([
        'pagePermissions.id',
        'pagePermissions.role',
        'pagePermissions.createdAt',
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .select((eb) =>
        eb
          .case()
          .when('groups.id', 'is not', null)
          .then(1)
          .else(0)
          .end()
          .as('isGroup'),
      )
      .where('pageAccessId', '=', pageAccessId);

    if (pagination.query) {
      baseQuery = baseQuery.where((eb) =>
        eb(
          sql`f_unaccent(users.name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        )
          .or(
            sql`users.email`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          )
          .or(
            sql`f_unaccent(groups.name)`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          ),
      );
    }

    const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'sub.isGroup', direction: 'desc', key: 'isGroup' },
        { expression: 'sub.id', direction: 'asc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        isGroup: parseInt(cursor.isGroup, 10),
        id: cursor.id,
      }),
    });

    const items: PagePermissionMember[] = result.items.map((member) => {
      if (member.userId) {
        return {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          avatarUrl: member.userAvatarUrl,
          type: 'user' as const,
          role: member.role,
          createdAt: member.createdAt,
        };
      }

      return {
        id: member.groupId,
        name: member.groupName,
        memberCount: member.memberCount as number,
        isDefault: member.groupIsDefault,
        type: 'group' as const,
        role: member.role,
        createdAt: member.createdAt,
      };
    });

    return { items, meta: result.meta };
  }

  async canUserAccessPage(userId: string, pageId: string): Promise<boolean> {
    const deniedAncestor = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as ancestorId', 'pages.parentPageId'])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select(['pages.id as ancestorId', 'pages.parentPageId']),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .leftJoin('pagePermissions', (join) =>
        join
          .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
          .on((eb) =>
            eb.or([
              eb('pagePermissions.userId', '=', userId),
              eb(
                'pagePermissions.groupId',
                'in',
                this.db
                  .selectFrom('groupUsers')
                  .select('groupUsers.groupId')
                  .where('groupUsers.userId', '=', userId),
              ),
            ]),
          ),
      )
      .select('pageAccess.pageId')
      .where('pagePermissions.id', 'is', null)
      .executeTakeFirst();

    return !deniedAncestor;
  }

  async canUserEditPage(
    userId: string,
    pageId: string,
  ): Promise<{
    hasAnyRestriction: boolean;
    canAccess: boolean;
    canEdit: boolean;
  }> {
    const result = await sql<{
      canAccess: boolean | null;
      canEdit: boolean | null;
    }>`
      WITH RECURSIVE ancestors AS (
        SELECT id AS ancestor_id, parent_page_id, 0 AS depth
        FROM pages
        WHERE id = ${pageId}::uuid
        UNION ALL
        SELECT p.id, p.parent_page_id, a.depth + 1
        FROM pages p
        JOIN ancestors a ON a.parent_page_id = p.id
      )
      SELECT
        bool_and(pp.id IS NOT NULL) AS "canAccess",
        (array_agg(pp.role ORDER BY a.depth ASC, pp.role DESC NULLS LAST))[1] = 'writer' AS "canEdit"
      FROM ancestors a
      JOIN page_access pa ON pa.page_id = a.ancestor_id
      LEFT JOIN page_permissions pp ON pp.page_access_id = pa.id
        AND (
          pp.user_id = ${userId}::uuid
          OR pp.group_id IN (
            SELECT gu.group_id FROM group_users gu WHERE gu.user_id = ${userId}::uuid
          )
        )
    `.execute(this.db);

    const row = result.rows[0];
    if (!row || row.canAccess === null) {
      return { hasAnyRestriction: false, canAccess: true, canEdit: true };
    }

    return {
      hasAnyRestriction: true,
      canAccess: row.canAccess,
      canEdit: row.canAccess && (row.canEdit ?? false),
    };
  }

  async getUserPageAccessLevel(
    userId: string,
    pageId: string,
  ): Promise<{
    hasDirectRestriction: boolean;
    hasInheritedRestriction: boolean;
    hasAnyRestriction: boolean;
    canAccess: boolean;
    canEdit: boolean;
    inheritedFrom?: {
      slugId: string;
      title: string;
    };
  }> {
    const [directRestriction, inheritedRestriction, inheritedFrom] =
      await Promise.all([
      this.db
        .selectFrom('pageAccess')
        .select('id')
        .where('pageId', '=', pageId)
        .executeTakeFirst(),
      this.db
        .withRecursive('ancestors', (qb) =>
          qb
            .selectFrom('pages')
            .select([
              'pages.id as ancestorId',
              'pages.parentPageId',
              sql<number>`0`.as('depth'),
            ])
            .where('pages.id', '=', pageId)
            .unionAll((eb) =>
              eb
                .selectFrom('pages')
                .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
                .select([
                  'pages.id as ancestorId',
                  'pages.parentPageId',
                  sql<number>`ancestors.depth + 1`.as('depth'),
                ]),
            ),
        )
        .selectFrom('ancestors')
        .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
        .where('ancestors.depth', '>', 0)
        .select('pageAccess.id')
        .executeTakeFirst(),
      this.db
        .withRecursive('ancestors', (qb) =>
          qb
            .selectFrom('pages')
            .select([
              'pages.id as ancestorId',
              'pages.slugId',
              'pages.title',
              'pages.parentPageId',
              sql<number>`0`.as('depth'),
            ])
            .where('pages.id', '=', pageId)
            .unionAll((eb) =>
              eb
                .selectFrom('pages')
                .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
                .select([
                  'pages.id as ancestorId',
                  'pages.slugId',
                  'pages.title',
                  'pages.parentPageId',
                  sql<number>`ancestors.depth + 1`.as('depth'),
                ]),
            ),
        )
        .selectFrom('ancestors')
        .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
        .where('ancestors.depth', '>', 0)
        .select(['ancestors.slugId', 'ancestors.title'])
        .orderBy('ancestors.depth', 'asc')
        .executeTakeFirst(),
    ]);

    const hasDirectRestriction = Boolean(directRestriction);
    const hasInheritedRestriction = Boolean(inheritedRestriction);
    const hasAnyRestriction = hasDirectRestriction || hasInheritedRestriction;

    if (!hasAnyRestriction) {
      return {
        hasDirectRestriction,
        hasInheritedRestriction,
        hasAnyRestriction,
        canAccess: true,
        canEdit: true,
        inheritedFrom: undefined,
      };
    }

    const access = await this.canUserEditPage(userId, pageId);

    return {
      hasDirectRestriction,
      hasInheritedRestriction,
      hasAnyRestriction,
      canAccess: access.canAccess,
      canEdit: access.canEdit,
      inheritedFrom: inheritedFrom
        ? {
            slugId: inheritedFrom.slugId,
            title: inheritedFrom.title,
          }
        : undefined,
    };
  }

  async hasRestrictedAncestor(pageId: string): Promise<boolean> {
    const result = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as ancestorId', 'pages.parentPageId'])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select(['pages.id as ancestorId', 'pages.parentPageId']),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .select('pageAccess.id')
      .executeTakeFirst();

    return Boolean(result);
  }

  async filterAccessiblePageIds(opts: {
    pageIds: string[];
    userId: string;
    spaceId?: string;
  }): Promise<string[]> {
    const { pageIds, userId, spaceId } = opts;

    if (pageIds.length === 0) {
      return [];
    }

    if (spaceId) {
      const hasRestrictions = await this.hasRestrictedPagesInSpace(spaceId);
      if (!hasRestrictions) {
        return pageIds;
      }
    }

    const results = await this.db
      .withRecursive('allAncestors', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as pageId', 'pages.id as ancestorId', 'pages.parentPageId'])
          .where('pages.id', 'in', pageIds)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('allAncestors', 'allAncestors.parentPageId', 'pages.id')
              .select([
                'allAncestors.pageId',
                'pages.id as ancestorId',
                'pages.parentPageId',
              ]),
          ),
      )
      .selectFrom('pages')
      .select('pages.id')
      .where('pages.id', 'in', pageIds)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('allAncestors')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'allAncestors.ancestorId',
              )
              .leftJoin('pagePermissions', (join) =>
                join
                  .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                  .on((eb) =>
                    eb.or([
                      eb('pagePermissions.userId', '=', userId),
                      eb(
                        'pagePermissions.groupId',
                        'in',
                        this.db
                          .selectFrom('groupUsers')
                          .select('groupUsers.groupId')
                          .where('groupUsers.userId', '=', userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('allAncestors.pageId', '=', 'pages.id')
              .where('pagePermissions.id', 'is', null),
          ),
        ),
      )
      .execute();

    return results.map((r) => r.id);
  }

  async hasRestrictedPagesInSpace(spaceId: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('pageAccess')
      .select('id')
      .where('spaceId', '=', spaceId)
      .limit(1)
      .executeTakeFirst();

    return Boolean(result);
  }
}
