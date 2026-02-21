import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiSession, InsertableAiSession } from '@docmost/db/types/entity.types';

@Injectable()
export class AiSessionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async create(data: {
    workspaceId: string;
    userId: string;
    pageId?: string;
    title: string;
  }): Promise<AiSession> {
    const now = new Date();
    const row: InsertableAiSession = {
      workspaceId: data.workspaceId,
      userId: data.userId,
      pageId: data.pageId ?? null,
      title: data.title,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db
      .insertInto('aiSessions')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async findById(id: string): Promise<AiSession | undefined> {
    return await this.db
      .selectFrom('aiSessions')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
    limit = 20,
  ): Promise<AiSession[]> {
    return await this.db
      .selectFrom('aiSessions')
      .where('workspaceId', '=', workspaceId)
      .where('userId', '=', userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .selectAll()
      .execute();
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await this.db
      .updateTable('aiSessions')
      .set({ title, updatedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async touch(id: string): Promise<void> {
    await this.db
      .updateTable('aiSessions')
      .set({ updatedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('aiSessions')
      .where('id', '=', id)
      .execute();
  }

  async updateSelectedPageIds(id: string, pageIds: string[]): Promise<void> {
    await this.db
      .updateTable('aiSessions')
      .set({ selectedPageIds: pageIds, updatedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }
}
