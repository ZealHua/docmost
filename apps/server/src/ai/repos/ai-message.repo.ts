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
  }): Promise<AiMessage> {
    const row: InsertableAiMessage = {
      sessionId: data.sessionId,
      workspaceId: data.workspaceId,
      role: data.role,
      content: data.content,
      sources: data.sources ?? [],
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
}
