import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely, sql } from 'kysely';
import { DB } from '../../database/types/db';
import { ActualUsage, EstimatedUsage } from '../utils/cost-estimator';

export interface QuotaCheckResult {
  allowed: boolean;
  reason: string;
  exceeded?: Array<{
    resource: string;
    used: number;
    limit: number;
    needed: number;
  }>;
}

export interface QuotaStatus {
  limits: {
    researchRequests: number;
    webSearches: number;
    crawlUrls: number;
    llmTokens: number;
  };
  used: {
    researchRequests: number;
    webSearches: number;
    crawlUrls: number;
    llmTokens: number;
  };
  totalCost: number;
  isEnabled: boolean;
  lastResetAt: Date;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  /**
   * Check if workspace has sufficient quota for the estimated usage
   */
  async checkQuota(
    workspaceId: string,
    userId: string,
    estimatedUsage: EstimatedUsage
  ): Promise<QuotaCheckResult> {
    try {
      const quota = await this.db
        .selectFrom('workspaceQuotas')
        .where('workspaceId', '=', workspaceId)
        .selectAll()
        .executeTakeFirst();

      if (!quota || !quota.isEnabled) {
        this.logger.log(`Quota check passed: Quota system disabled for workspace ${workspaceId}`);
        return { allowed: true, reason: 'Quota system disabled' };
      }

      // Check if limits would be exceeded
      const wouldExceed = [];

      if (quota.webSearchesUsed + estimatedUsage.webSearches > quota.webSearchesLimit) {
        wouldExceed.push({
          resource: 'web_searches',
          used: quota.webSearchesUsed,
          limit: quota.webSearchesLimit,
          needed: estimatedUsage.webSearches,
        });
      }

      if (quota.crawlUrlsUsed + estimatedUsage.crawlUrls > quota.crawlUrlsLimit) {
        wouldExceed.push({
          resource: 'crawl_urls',
          used: quota.crawlUrlsUsed,
          limit: quota.crawlUrlsLimit,
          needed: estimatedUsage.crawlUrls,
        });
      }

      if (quota.llmTokensUsed + estimatedUsage.llmTokens > quota.llmTokensLimit) {
        wouldExceed.push({
          resource: 'llm_tokens',
          used: quota.llmTokensUsed,
          limit: quota.llmTokensLimit,
          needed: estimatedUsage.llmTokens,
        });
      }

      if (wouldExceed.length > 0) {
        this.logger.warn(`Quota check failed for workspace ${workspaceId}: ${JSON.stringify(wouldExceed)}`);
        return {
          allowed: false,
          reason: 'Quota would be exceeded',
          exceeded: wouldExceed,
        };
      }

      this.logger.log(`Quota check passed for workspace ${workspaceId}`);
      return { allowed: true, reason: 'Sufficient quota available' };
    } catch (error: any) {
      this.logger.error(`Error checking quota for workspace ${workspaceId}: ${error.message}`);
      // Fail open - allow if we can't check quota
      return { allowed: true, reason: 'Error checking quota, allowing by default' };
    }
  }

  /**
   * Consume quota after successful research completion
   */
  async consumeQuota(
    workspaceId: string,
    usage: ActualUsage
  ): Promise<void> {
    try {
      await this.db
        .updateTable('workspaceQuotas')
        .set({
          researchRequestsUsed: (eb) => eb('researchRequestsUsed', '+', usage.researchRequests),
          webSearchesUsed: (eb) => eb('webSearchesUsed', '+', usage.webSearches),
          crawlUrlsUsed: (eb) => eb('crawlUrlsUsed', '+', usage.crawlUrls),
          llmTokensUsed: (eb) => eb('llmTokensUsed', '+', usage.llmTokens),
          totalCostThisMonth: sql`total_cost_this_month + ${usage.cost}`,
          updatedAt: new Date(),
        })
        .where('workspaceId', '=', workspaceId)
        .execute();

      this.logger.log(`Consumed quota for workspace ${workspaceId}: ${JSON.stringify(usage)}`);
    } catch (error: any) {
      this.logger.error(`Error consuming quota for workspace ${workspaceId}: ${error.message}`);
      // Don't throw - we don't want to fail the research if quota tracking fails
    }
  }

  /**
   * Reset monthly quotas for all workspaces (run via cron job)
   */
  async resetMonthlyQuotas(): Promise<void> {
    try {
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

      this.logger.log(`Reset monthly quotas for ${result.length} workspaces`);
    } catch (error: any) {
      this.logger.error(`Error resetting monthly quotas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current quota status for a workspace
   */
  async getQuotaStatus(workspaceId: string): Promise<QuotaStatus | null> {
    try {
      const quota = await this.db
        .selectFrom('workspaceQuotas')
        .where('workspaceId', '=', workspaceId)
        .selectAll()
        .executeTakeFirst();

      if (!quota) {
        return null;
      }

      return {
        limits: {
          researchRequests: quota.researchRequestsLimit,
          webSearches: quota.webSearchesLimit,
          crawlUrls: quota.crawlUrlsLimit,
          llmTokens: quota.llmTokensLimit,
        },
        used: {
          researchRequests: quota.researchRequestsUsed,
          webSearches: quota.webSearchesUsed,
          crawlUrls: quota.crawlUrlsUsed,
          llmTokens: quota.llmTokensUsed,
        },
        totalCost: parseFloat(quota.totalCostThisMonth.toString()),
        isEnabled: quota.isEnabled,
        lastResetAt: quota.lastResetAt,
      };
    } catch (error: any) {
      this.logger.error(`Error getting quota status for workspace ${workspaceId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update quota limits for a workspace (admin function)
   */
  async updateQuotaLimits(
    workspaceId: string,
    limits: Partial<{
      researchRequests: number;
      webSearches: number;
      crawlUrls: number;
      llmTokens: number;
    }>
  ): Promise<void> {
    try {
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

      this.logger.log(`Updated quota limits for workspace ${workspaceId}`);
    } catch (error: any) {
      this.logger.error(`Error updating quota limits for workspace ${workspaceId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enable or disable quota enforcement for a workspace
   */
  async setQuotaEnabled(workspaceId: string, enabled: boolean): Promise<void> {
    try {
      await this.db
        .updateTable('workspaceQuotas')
        .set({
          isEnabled: enabled,
          updatedAt: new Date(),
        })
        .where('workspaceId', '=', workspaceId)
        .execute();

      this.logger.log(`Quota ${enabled ? 'enabled' : 'disabled'} for workspace ${workspaceId}`);
    } catch (error: any) {
      this.logger.error(`Error setting quota enabled for workspace ${workspaceId}: ${error.message}`);
      throw error;
    }
  }
}