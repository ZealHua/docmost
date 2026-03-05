import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { DB } from '../../database/types/db';
import { ResearchPlan } from '../services/planning.service';

export interface ResearchSessionRecord {
  id: string;
  sessionId?: string;
  workspaceId: string;
  userId: string;
  query: string;
  plan?: ResearchPlan;
  finalReport?: string;
  webSearchesCount: number;
  crawlUrlsCount: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  estimatedCost: number;
  status: 'awaiting_approval' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  approvedAt?: Date;
  approvedById?: string;
  approvedPlanHash?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchOperationRecord {
  id: string;
  researchSessionId: string;
  workspaceId: string;
  operationType: 'web_search' | 'crawl_url' | 'llm_query';
  operationDetails: Record<string, any>;
  costAmount: number;
  costCurrency: string;
  createdAt: Date;
}

@Injectable()
export class ResearchSessionRepo {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  /**
   * Create a new research session
   */
  async create(data: {
    sessionId?: string;
    workspaceId: string;
    userId: string;
    query: string;
    plan?: ResearchPlan;
    estimatedCost?: number;
    status?: 'awaiting_approval' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  }): Promise<ResearchSessionRecord> {
    const result = await this.db
      .insertInto('researchSessions')
      .values({
        sessionId: data.sessionId,
        workspaceId: data.workspaceId,
        userId: data.userId,
        query: data.query,
        plan: data.plan ? JSON.stringify(data.plan) : undefined,
        estimatedCost: data.estimatedCost ?? 0,
        status: data.status,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      sessionId: result.sessionId || undefined,
      workspaceId: result.workspaceId,
      userId: result.userId,
      query: result.query,
      plan: result.plan ? JSON.parse(result.plan as string) : undefined,
      finalReport: result.finalReport || undefined,
      webSearchesCount: result.webSearchesCount,
      crawlUrlsCount: result.crawlUrlsCount,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      estimatedCost: parseFloat(result.estimatedCost.toString()),
      status: result.status as ResearchSessionRecord['status'],
      errorMessage: result.errorMessage || undefined,
      approvedAt: result.approvedAt || undefined,
      approvedById: result.approvedById || undefined,
      approvedPlanHash: result.approvedPlanHash || undefined,
      startedAt: result.startedAt,
      completedAt: result.completedAt || undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Find research session by ID
   */
  async findById(id: string): Promise<ResearchSessionRecord | undefined> {
    const result = await this.db
      .selectFrom('researchSessions')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();

    if (!result) {
      return undefined;
    }

    return {
      id: result.id,
      sessionId: result.sessionId || undefined,
      workspaceId: result.workspaceId,
      userId: result.userId,
      query: result.query,
      plan: result.plan ? JSON.parse(result.plan as string) : undefined,
      finalReport: result.finalReport || undefined,
      webSearchesCount: result.webSearchesCount,
      crawlUrlsCount: result.crawlUrlsCount,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      estimatedCost: parseFloat(result.estimatedCost.toString()),
      status: result.status as ResearchSessionRecord['status'],
      errorMessage: result.errorMessage || undefined,
      approvedAt: result.approvedAt || undefined,
      approvedById: result.approvedById || undefined,
      approvedPlanHash: result.approvedPlanHash || undefined,
      startedAt: result.startedAt,
      completedAt: result.completedAt || undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Update research session
   */
  async update(
    id: string,
    data: Partial<{
      plan: ResearchPlan;
      finalReport: string;
      webSearchesCount: number;
      crawlUrlsCount: number;
      llmInputTokens: number;
      llmOutputTokens: number;
      status: 'awaiting_approval' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
      errorMessage: string;
      completedAt: Date;
      approvedAt: Date;
      approvedById: string;
      approvedPlanHash: string;
    }>
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.plan !== undefined) {
      updateData.plan = JSON.stringify(data.plan);
    }
    if (data.finalReport !== undefined) {
      updateData.finalReport = data.finalReport;
    }
    if (data.webSearchesCount !== undefined) {
      updateData.webSearchesCount = data.webSearchesCount;
    }
    if (data.crawlUrlsCount !== undefined) {
      updateData.crawlUrlsCount = data.crawlUrlsCount;
    }
    if (data.llmInputTokens !== undefined) {
      updateData.llmInputTokens = data.llmInputTokens;
    }
    if (data.llmOutputTokens !== undefined) {
      updateData.llmOutputTokens = data.llmOutputTokens;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.errorMessage !== undefined) {
      updateData.errorMessage = data.errorMessage;
    }
    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt;
    }
    if (data.approvedAt !== undefined) {
      updateData.approvedAt = data.approvedAt;
    }
    if (data.approvedById !== undefined) {
      updateData.approvedById = data.approvedById;
    }
    if (data.approvedPlanHash !== undefined) {
      updateData.approvedPlanHash = data.approvedPlanHash;
    }

    await this.db
      .updateTable('researchSessions')
      .set(updateData)
      .where('id', '=', id)
      .execute();
  }

  /**
   * Complete a research session
   */
  async complete(
    id: string,
    data: {
      finalReport: string;
      webSearchesCount: number;
      crawlUrlsCount: number;
      llmInputTokens: number;
      llmOutputTokens: number;
    }
  ): Promise<void> {
    await this.update(id, {
      ...data,
      status: 'completed',
      completedAt: new Date(),
    });
  }

  /**
   * Fail a research session
   */
  async fail(id: string, errorMessage: string): Promise<void> {
    await this.update(id, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });
  }

  /**
   * Find research sessions by workspace
   */
  async findByWorkspace(
    workspaceId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    sessions: ResearchSessionRecord[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .orderBy('startedAt desc')
        .limit(limit)
        .offset(offset)
        .selectAll()
        .execute(),
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
    ]);

    return {
      sessions: sessions.map((result) => ({
        id: result.id,
        sessionId: result.sessionId || undefined,
        workspaceId: result.workspaceId,
        userId: result.userId,
        query: result.query,
        plan: result.plan ? JSON.parse(result.plan as string) : undefined,
        finalReport: result.finalReport || undefined,
        webSearchesCount: result.webSearchesCount,
        crawlUrlsCount: result.crawlUrlsCount,
        llmInputTokens: result.llmInputTokens,
        llmOutputTokens: result.llmOutputTokens,
        estimatedCost: parseFloat(result.estimatedCost.toString()),
        status: result.status as ResearchSessionRecord['status'],
        errorMessage: result.errorMessage || undefined,
        approvedAt: result.approvedAt || undefined,
        approvedById: result.approvedById || undefined,
        approvedPlanHash: result.approvedPlanHash || undefined,
        startedAt: result.startedAt,
        completedAt: result.completedAt || undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      })),
      total: parseInt(total?.count as string || '0'),
    };
  }

  /**
   * Create a research operation record
   */
  async createOperation(data: {
    researchSessionId: string;
    workspaceId: string;
    operationType: 'web_search' | 'crawl_url' | 'llm_query';
    operationDetails: Record<string, any>;
    costAmount: number;
    costCurrency?: string;
  }): Promise<ResearchOperationRecord> {
    const result = await this.db
      .insertInto('researchOperations')
      .values({
        researchSessionId: data.researchSessionId,
        workspaceId: data.workspaceId,
        operationType: data.operationType,
        operationDetails: JSON.stringify(data.operationDetails),
        costAmount: data.costAmount,
        costCurrency: data.costCurrency || 'USD',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      researchSessionId: result.researchSessionId,
      workspaceId: result.workspaceId,
      operationType: result.operationType as ResearchOperationRecord['operationType'],
      operationDetails: result.operationDetails ? JSON.parse(result.operationDetails as string) : {},
      costAmount: parseFloat(result.costAmount.toString()),
      costCurrency: result.costCurrency,
      createdAt: result.createdAt,
    };
  }

  /**
   * Get operations for a research session
   */
  async getOperations(researchSessionId: string): Promise<ResearchOperationRecord[]> {
    const results = await this.db
      .selectFrom('researchOperations')
      .where('researchSessionId', '=', researchSessionId)
      .orderBy('createdAt asc')
      .selectAll()
      .execute();

    return results.map((result) => ({
      id: result.id,
      researchSessionId: result.researchSessionId,
      workspaceId: result.workspaceId,
      operationType: result.operationType as ResearchOperationRecord['operationType'],
      operationDetails: result.operationDetails ? JSON.parse(result.operationDetails as string) : {},
      costAmount: parseFloat(result.costAmount.toString()),
      costCurrency: result.costCurrency,
      createdAt: result.createdAt,
    }));
  }

  /**
   * Get total cost for a research session
   */
  async getTotalCost(researchSessionId: string): Promise<number> {
    const result = await this.db
      .selectFrom('researchOperations')
      .where('researchSessionId', '=', researchSessionId)
      .select((eb) => eb.fn.sum('costAmount').as('totalCost'))
      .executeTakeFirst();

    return result && result.totalCost ? parseFloat(result.totalCost.toString()) : 0;
  }

  async countByStatuses(workspaceId: string, userId: string): Promise<{
    awaitingApproval: number;
    approved: number;
    completed: number;
    cancelled: number;
  }> {
    const [awaitingApprovalResult, approvedResult, completedResult, cancelledResult] = await Promise.all([
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .where('userId', '=', userId)
        .where('status', '=', 'awaiting_approval')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .where('userId', '=', userId)
        .where('approvedAt', 'is not', null)
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .where('userId', '=', userId)
        .where('status', '=', 'completed')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('researchSessions')
        .where('workspaceId', '=', workspaceId)
        .where('userId', '=', userId)
        .where('status', '=', 'cancelled')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
    ]);

    return {
      awaitingApproval: parseInt(awaitingApprovalResult?.count as string || '0'),
      approved: parseInt(approvedResult?.count as string || '0'),
      completed: parseInt(completedResult?.count as string || '0'),
      cancelled: parseInt(cancelledResult?.count as string || '0'),
    };
  }
}