import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiMessage, InsertableAiMessage } from '@docmost/db/types/entity.types';

@Injectable()
export class AiMessageRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async create(data: {
    sessionId: string;
    workspaceId: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Record<string, any>[];
    audit?: Record<string, any>;
  }): Promise<AiMessage> {
    const row: InsertableAiMessage = {
      sessionId: data.sessionId,
      workspaceId: data.workspaceId,
      role: data.role,
      content: data.content,
      sources: data.sources ?? [],
      audit: data.audit,
      createdAt: new Date(),
    };

    const result = await this.db
      .insertInto('aiMessages')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async findBySessionId(sessionId: string): Promise<AiMessage[]> {
    return await this.db
      .selectFrom('aiMessages')
      .where('sessionId', '=', sessionId)
      .orderBy('createdAt', 'asc')
      .selectAll()
      .execute();
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.db
      .deleteFrom('aiMessages')
      .where('sessionId', '=', sessionId)
      .execute();
  }

  async deleteFromTimestamp(sessionId: string, fromCreatedAt: Date): Promise<void> {
    await this.db
      .deleteFrom('aiMessages')
      .where('sessionId', '=', sessionId)
      .where('createdAt', '>=', fromCreatedAt)
      .execute();
  }

  async countAssistantMessagesWithApprovalAudit(workspaceId: string, userId: string): Promise<number> {
    const result = await this.db
      .selectFrom('aiMessages as m')
      .innerJoin('aiSessions as s', 's.id', 'm.sessionId')
      .where('m.workspaceId', '=', workspaceId)
      .where('s.workspaceId', '=', workspaceId)
      .where('s.userId', '=', userId)
      .where('m.role', '=', 'assistant')
      .where('m.audit', 'is not', null)
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst();

    return parseInt(result?.count as string || '0');
  }
}
