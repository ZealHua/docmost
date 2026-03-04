import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely, sql } from 'kysely';
import { DB } from '../../database/types/db';

export interface QuotaRecord {
  id: string;
  workspaceId: string;
  researchRequestsLimit: number;
  webSearchesLimit: number;
  crawlUrlsLimit: number;
  llmTokensLimit: number;
  researchRequestsUsed: number;
  webSearchesUsed: number;
  crawlUrlsUsed: number;
  llmTokensUsed: number;
  totalCostThisMonth: number;
  currency: string;
  isEnabled: boolean;
  lastResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class QuotaRepo {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  /**
   * Find quota record by workspace ID
   */
  async findByWorkspaceId(workspaceId: string): Promise<QuotaRecord | undefined> {
    const result = await this.db
      .selectFrom('workspaceQuotas')
      .where('workspaceId', '=', workspaceId)
      .selectAll()
      .executeTakeFirst();

    if (!result) {
      return undefined;
    }

    return {
      id: result.id,
      workspaceId: result.workspaceId,
      researchRequestsLimit: result.researchRequestsLimit,
      webSearchesLimit: result.webSearchesLimit,
      crawlUrlsLimit: result.crawlUrlsLimit,
      llmTokensLimit: result.llmTokensLimit,
      researchRequestsUsed: result.researchRequestsUsed,
      webSearchesUsed: result.webSearchesUsed,
      crawlUrlsUsed: result.crawlUrlsUsed,
      llmTokensUsed: result.llmTokensUsed,
      totalCostThisMonth: parseFloat(result.totalCostThisMonth.toString()),
      currency: result.currency,
      isEnabled: result.isEnabled,
      lastResetAt: result.lastResetAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Create quota record for a workspace
   */
  async create(workspaceId: string, limits: {
    researchRequests?: number;
    webSearches?: number;
    crawlUrls?: number;
    llmTokens?: number;
  } = {}): Promise<QuotaRecord> {
    const result = await this.db
      .insertInto('workspaceQuotas')
      .values({
        workspaceId: workspaceId,
        researchRequestsLimit: limits.researchRequests ?? 100,
        webSearchesLimit: limits.webSearches ?? 500,
        crawlUrlsLimit: limits.crawlUrls ?? 1000,
        llmTokensLimit: limits.llmTokens ?? 1000000,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      workspaceId: result.workspaceId,
      researchRequestsLimit: result.researchRequestsLimit,
      webSearchesLimit: result.webSearchesLimit,
      crawlUrlsLimit: result.crawlUrlsLimit,
      llmTokensLimit: result.llmTokensLimit,
      researchRequestsUsed: result.researchRequestsUsed,
      webSearchesUsed: result.webSearchesUsed,
      crawlUrlsUsed: result.crawlUrlsUsed,
      llmTokensUsed: result.llmTokensUsed,
      totalCostThisMonth: parseFloat(result.totalCostThisMonth.toString()),
      currency: result.currency,
      isEnabled: result.isEnabled,
      lastResetAt: result.lastResetAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Update quota usage
   */
  async updateUsage(
    workspaceId: string,
    usage: {
      researchRequests?: number;
      webSearches?: number;
      crawlUrls?: number;
      llmTokens?: number;
      cost?: number;
    }
  ): Promise<void> {
    await this.db
      .updateTable('workspaceQuotas')
      .set((eb) => ({
        researchRequestsUsed: eb('researchRequestsUsed', '+', usage.researchRequests ?? 0),
        webSearchesUsed: eb('webSearchesUsed', '+', usage.webSearches ?? 0),
        crawlUrlsUsed: eb('crawlUrlsUsed', '+', usage.crawlUrls ?? 0),
        llmTokensUsed: eb('llmTokensUsed', '+', usage.llmTokens ?? 0),
        totalCostThisMonth: sql`total_cost_this_month + ${usage.cost ?? 0}`,
        updatedAt: new Date(),
      }))
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  /**
   * Reset monthly quotas for all workspaces
   */
  async resetMonthlyQuotas(): Promise<number> {
    const result = await this.db
      .updateTable('workspaceQuotas')
      .set({
        researchRequestsUsed: 0,
        webSearchesUsed: 0,
        crawlUrlsUsed: 0,
        llmTokensUsed: 0,
        totalCostThisMonth: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    return result.length;
  }

  /**
   * Update quota limits
   */
  async updateLimits(
    workspaceId: string,
    limits: Partial<{
      researchRequests: number;
      webSearches: number;
      crawlUrls: number;
      llmTokens: number;
    }>
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (limits.researchRequests !== undefined) {
      updateData.researchRequestsLimit = limits.researchRequests;
    }
    if (limits.webSearches !== undefined) {
      updateData.webSearchesLimit = limits.webSearches;
    }
    if (limits.crawlUrls !== undefined) {
      updateData.crawlUrlsLimit = limits.crawlUrls;
    }
    if (limits.llmTokens !== undefined) {
      updateData.llmTokensLimit = limits.llmTokens;
    }

    await this.db
      .updateTable('workspaceQuotas')
      .set(updateData)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  /**
   * Enable or disable quota enforcement
   */
  async setEnabled(workspaceId: string, enabled: boolean): Promise<void> {
    await this.db
      .updateTable('workspaceQuotas')
      .set({
        isEnabled: enabled,
        updatedAt: new Date(),
      })
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}