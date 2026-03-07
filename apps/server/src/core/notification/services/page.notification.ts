import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IPageMentionNotificationJob,
  IPagePermissionGrantedNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageMentionEmail } from '@docmost/transactional/emails/page-mention-email';
import { PagePermissionEmail } from '@docmost/transactional/emails/page-permission-email';
import { getPageTitle } from '../../../common/helpers';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

@Injectable()
export class PageNotificationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async processPageMention(data: IPageMentionNotificationJob, appUrl: string) {
    const { userMentions, oldMentionedUserIds, pageId, spaceId, workspaceId } =
      data;

    const oldIds = new Set(oldMentionedUserIds);
    const newMentions = userMentions.filter(
      (m) => !oldIds.has(m.userId) && m.creatorId !== m.userId,
    );

    if (newMentions.length === 0) return;

    const candidateUserIds = newMentions.map((m) => m.userId);
    const usersWithAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
        candidateUserIds,
        spaceId,
      );

    let accessibleMentions = newMentions.filter((m) =>
      usersWithAccess.has(m.userId),
    );

    const hasRestrictedAncestor = await this.pagePermissionRepo.hasRestrictedAncestor(
      pageId,
    );

    if (hasRestrictedAncestor) {
      accessibleMentions = (
        await Promise.all(
          accessibleMentions.map(async (mention) => {
            const canAccess = await this.pagePermissionRepo.canUserAccessPage(
              mention.userId,
              pageId,
            );

            return canAccess ? mention : null;
          }),
        )
      ).filter((mention): mention is (typeof accessibleMentions)[number] => Boolean(mention));
    }

    if (accessibleMentions.length === 0) return;

    const mentionsByCreator = new Map<
      string,
      { userId: string; mentionId: string }[]
    >();
    for (const m of accessibleMentions) {
      const list = mentionsByCreator.get(m.creatorId) || [];
      list.push({ userId: m.userId, mentionId: m.mentionId });
      mentionsByCreator.set(m.creatorId, list);
    }

    for (const [actorId, mentions] of mentionsByCreator) {
      await this.notifyMentionedUsers(
        mentions,
        actorId,
        pageId,
        spaceId,
        workspaceId,
        appUrl,
      );
    }
  }

  async processPagePermissionGranted(
    data: IPagePermissionGrantedNotificationJob,
    appUrl: string,
  ) {
    const {
      recipientUserIds,
      actorId,
      pageId,
      spaceId,
      workspaceId,
      role,
    } = data;

    const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
    if (!context) return;

    const usersWithAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
      recipientUserIds,
      spaceId,
    );

    const hasRestrictedAncestor = await this.pagePermissionRepo.hasRestrictedAncestor(
      pageId,
    );

    const subject =
      role === 'writer'
        ? `${context.actor.name} gave you edit access to ${context.pageTitle}`
        : `${context.actor.name} gave you view access to ${context.pageTitle}`;

    for (const userId of recipientUserIds) {
      if (!usersWithAccess.has(userId) || userId === actorId) {
        continue;
      }

      if (hasRestrictedAncestor) {
        const canAccess = await this.pagePermissionRepo.canUserAccessPage(
          userId,
          pageId,
        );

        if (!canAccess) {
          continue;
        }
      }

      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_PERMISSION_GRANTED,
        actorId,
        pageId,
        spaceId,
        data: { role },
      });

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        PagePermissionEmail({
          actorName: context.actor.name,
          pageTitle: context.pageTitle,
          pageUrl: context.basePageUrl,
          role,
        }),
      );
    }
  }

  private async notifyMentionedUsers(
    mentions: { userId: string; mentionId: string }[],
    actorId: string,
    pageId: string,
    spaceId: string,
    workspaceId: string,
    appUrl: string,
  ) {
    const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
    if (!context) return;

    const { actor, pageTitle, basePageUrl } = context;

    for (const { userId, mentionId } of mentions) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        data: { mentionId },
      });

      const pageUrl = `${basePageUrl}`;
      const subject = `${actor.name} mentioned you in ${pageTitle}`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        PageMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );
    }
  }

  private async getPageContext(
    actorId: string,
    pageId: string,
    spaceId: string,
    appUrl: string,
  ) {
    const [actor, page, space] = await Promise.all([
      this.db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('id', '=', actorId)
        .executeTakeFirst(),
      this.db
        .selectFrom('pages')
        .select(['id', 'title', 'slugId'])
        .where('id', '=', pageId)
        .executeTakeFirst(),
      this.db
        .selectFrom('spaces')
        .select(['id', 'slug'])
        .where('id', '=', spaceId)
        .executeTakeFirst(),
    ]);

    if (!actor || !page || !space) {
      return null;
    }

    const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;

    return { actor, pageTitle: getPageTitle(page.title), basePageUrl };
  }
}
