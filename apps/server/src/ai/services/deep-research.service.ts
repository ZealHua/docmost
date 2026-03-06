import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { QuotaService } from './quota.service';
import { ClarificationService } from './clarification.service';
import { PlanningService, ResearchPlan, ResearchContext } from './planning.service';
import { JinaCrawlerService } from './jina-crawler.service';
import { ContentExtractorService, ExtractedContent } from './content-extractor.service';
import { WebSearchService } from './web-search.service';
import { TavilyResearchService } from './tavily-research.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ResearchSessionRepo } from '../repos/research-session.repo';
import { AiSessionRepo } from '../repos/ai-session.repo';
import { CostEstimator } from '../utils/cost-estimator';
import { getDeepResearchTemplate } from './deep-research-templates';

export interface DeepResearchOptions {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  sessionId?: string;
  model?: string;
  templateId?: string;
  workspaceId: string;
  userId: string;
  isWebSearchEnabled: boolean;
  selectedPageIds?: string[];
  clarificationRound?: number;
  researchSessionId?: string;
  approvedPlan?: ResearchPlan;
}

export interface ResearchResult {
  success: boolean;
  report?: string;
  sources: Array<{
    url: string;
    title: string;
    content: string;
    wordCount: number;
  }>;
  researchSessionId: string;
  totalCost: number;
  metrics?: {
    discoveredCandidates: number;
    usableSources: number;
    filteredLowContent: number;
    citedSources: number;
    crawlAttempted: number;
    crawlSuccess: number;
    crawlFailed: number;
  };
  error?: string;
}

export interface ResearchSessionAudit {
  researchSessionId: string;
  status: string;
  approvedAt?: string;
  approvedById?: string;
  approvedPlanHash?: string;
  completedAt?: string;
}

export type ResearchEvent =
  | { type: 'quota_check'; data: { allowed: boolean; reason: string } }
  | {
      type: 'clarification_needed';
      data: {
        questions: Array<{ id: string; question: string; options?: string[]; required?: boolean }>;
        context: string;
        round: number;
      };
    }
  | { type: 'clarification_complete'; data: { finalQuery: string } }
  | { type: 'plan_generated'; data: ResearchPlan & { researchSessionId: string; planHash: string } }
  | { type: 'plan_validated'; data: { isSufficient: boolean; recommendations: string[] } }
  | { type: 'plan_approved'; data: { planId: string } }
  | { type: 'step_started'; data: { stepId: string; title: string; description: string } }
  | { type: 'step_progress'; data: { stepId: string; progress: number; status: string } }
  | { type: 'step_completed'; data: { stepId: string } }
  | {
      type: 'source_summary';
      data: {
        scope: 'discovered' | 'usable' | 'filtered_low_content';
        delta: number;
        total: number;
      };
    }
  | { type: 'sources'; data: Array<{ url: string; title: string; excerpt: string }> }
  | { type: 'chunk'; data: string }
  | { type: 'complete'; data: ResearchResult }
  | { type: 'error'; data: { phase: string; error: string; recoverable: boolean } }
  | { type: 'quota_exceeded'; data: any };

@Injectable()
export class DeepResearchService {
  private readonly logger = new Logger(DeepResearchService.name);
  private readonly debug: boolean;
  private readonly MAX_CLARIFICATION_ROUNDS = 1;
  private readonly MAX_CRAWL_URLS_PER_STEP = 3;
  private readonly MAX_CRAWL_CANDIDATES_PER_STEP = 5;
  private readonly MAX_RECOVERY_URLS_PER_QUERY = 4;
  private readonly MAX_MERGED_SEARCH_RESULTS = 8;
  private readonly MIN_EXTRACTED_WORDS = 120;
  private readonly MIN_CITATION_TARGET = 3;
  private readonly DEFAULT_SESSION_TITLE = 'New Chat';
  private readonly MAX_SESSION_TITLE_LENGTH = 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly quotaService: QuotaService,
    private readonly clarificationService: ClarificationService,
    private readonly planningService: PlanningService,
    private readonly jinaCrawlerService: JinaCrawlerService,
    private readonly contentExtractorService: ContentExtractorService,
    private readonly webSearchService: WebSearchService,
    private readonly tavilyResearchService: TavilyResearchService,
    private readonly orchestrator: AiOrchestratorService,
    private readonly researchSessionRepo: ResearchSessionRepo,
    private readonly aiSessionRepo: AiSessionRepo,
  ) {
    this.debug = this.configService.get<string>('AI_DEBUG') === 'true';
  }

  /**
   * Execute deep research with event streaming
   */
  async execute(
    options: DeepResearchOptions,
    onEvent: (event: ResearchEvent) => void,
    signal?: AbortSignal
  ): Promise<ResearchResult> {
    const startTime = Date.now();
    let researchSessionId = '';
    const operations: any[] = [];
    const recoverableStepErrors: string[] = [];
    let discoveredSourceCount = 0;
    let crawlAttemptedCount = 0;
    let crawlSuccessCount = 0;
    let crawlFailureCount = 0;
    let recoveryAttempted = false;
    let recoveryRecoveredSources = 0;
    let recoveryQueriesTried: string[] = [];
    let tavilyDiscoveryHits = 0;
    let serperSearchQueries = 0;
    let executionWaveCount = 0;
    let filteredLowContentCount = 0;
    let usableSourceCount = 0;
    let queryDerivedSessionTitle = '';
    const stepSearchResults = new Map<string, Array<{ url: string; title: string; excerpt: string }>>();

    try {
      this.log(`Starting deep research for workspace ${options.workspaceId}`);
      const messages = [...options.messages];
      let plan: ResearchPlan;

      if (options.researchSessionId) {
        const existingSession = await this.researchSessionRepo.findById(options.researchSessionId);

        if (!existingSession) {
          throw new Error('Research session not found');
        }
        if (existingSession.workspaceId !== options.workspaceId || existingSession.userId !== options.userId) {
          throw new Error('Research session access denied');
        }
        if (existingSession.status !== 'in_progress') {
          throw new Error(`Research session is not resumable (status: ${existingSession.status})`);
        }

        if (options.approvedPlan) {
          throw new Error('Approved plan must be submitted via continuation endpoint before streaming');
        }

        const continuationPlan = existingSession.plan;
        if (!continuationPlan || !continuationPlan.steps || continuationPlan.steps.length === 0) {
          throw new Error('No valid approved plan found for continuation');
        }

        plan = continuationPlan;
        researchSessionId = existingSession.id;
      } else {
        const clarificationRound = options.clarificationRound || 0;

        if (clarificationRound < this.MAX_CLARIFICATION_ROUNDS) {
          const clarificationResult = await this.clarificationService.needsClarification(
            messages,
            clarificationRound,
            signal
          );

          if (clarificationResult.needsClarification) {
            const clarificationQuestion = await this.clarificationService.generateClarification(
              messages,
              clarificationRound,
              signal
            );

            onEvent({
              type: 'clarification_needed',
              data: {
                questions: clarificationQuestion.questions,
                context: clarificationQuestion.context,
                round: clarificationRound,
              },
            });

            throw new Error('CLARIFICATION_NEEDED');
          }
        }

        onEvent({
          type: 'clarification_complete',
          data: { finalQuery: messages[messages.length - 1].content },
        });

        queryDerivedSessionTitle = this.deriveSessionTitleFromText(messages[messages.length - 1].content);
        await this.tryUpdateSessionTitle(
          options.sessionId,
          queryDerivedSessionTitle,
          [this.DEFAULT_SESSION_TITLE]
        );

        plan = await this.planningService.generatePlan(
          messages,
          {
            hasInternalSources: (options.selectedPageIds?.length || 0) > 0,
            hasWebSearch: options.isWebSearchEnabled,
            selectedPages: [],
            conversationHistory: messages,
            clarificationRound,
          },
          signal
        );

        plan = this.applyLightResearchProfile(plan);
        this.ensurePlanIsExecutable(plan);

        const estimatedUsage = CostEstimator.estimateResearchCost(plan);

        const quotaCheck = await this.quotaService.checkQuota(
          options.workspaceId,
          options.userId,
          estimatedUsage
        );

        onEvent({
          type: 'quota_check',
          data: quotaCheck,
        });

        if (!quotaCheck.allowed) {
          onEvent({
            type: 'quota_exceeded',
            data: quotaCheck,
          });
          throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
        }

        const researchSession = await this.researchSessionRepo.create({
          sessionId: options.sessionId,
          workspaceId: options.workspaceId,
          userId: options.userId,
          query: messages[messages.length - 1].content,
          plan,
          estimatedCost: estimatedUsage.estimatedCost,
          status: 'in_progress',
        });
        const approvedPlanHash = this.hashResearchPlan(researchSession.plan || plan);

        await this.researchSessionRepo.update(researchSession.id, {
          approvedAt: new Date(),
          approvedById: options.userId,
          approvedPlanHash,
        });

        plan = researchSession.plan || plan;
        researchSessionId = researchSession.id;

        await this.tryUpdateSessionTitle(
          options.sessionId,
          this.deriveSessionTitleFromText(plan.title),
          [this.DEFAULT_SESSION_TITLE, queryDerivedSessionTitle]
        );

        onEvent({
          type: 'plan_generated',
          data: {
            ...plan,
            researchSessionId,
            planHash: approvedPlanHash,
          },
        });
      }

      // Phase 4: Execute approved plan
      const sources: Array<{
        url: string;
        title: string;
        content: string;
        wordCount: number;
      }> = [];

      const planSteps = plan.steps || [];

      const pendingSteps = [...planSteps];
      const completedStepIds = new Set<string>();

      const runStep = async (step: ResearchPlan['steps'][number]): Promise<void> => {
        if (signal?.aborted) {
          throw new Error('Research aborted');
        }

        onEvent({
          type: 'step_started',
          data: {
            stepId: step.id,
            title: step.title,
            description: step.description,
          },
        });

        try {
          switch (step.type) {
            case 'search':
              if (step.query && options.isWebSearchEnabled) {
                const mergedSearch = await this.searchAndMergeWebSources(step.query, this.MAX_MERGED_SEARCH_RESULTS);
                operations.push(CostEstimator.createWebSearchOperation(step.query));
                operations.push(CostEstimator.createWebSearchOperation(step.query));

                if (mergedSearch.provider.tavilyHit) {
                  tavilyDiscoveryHits += 1;
                }
                if (mergedSearch.provider.serperHit) {
                  serperSearchQueries += 1;
                }

                if (mergedSearch.errors.length > 0) {
                  recoverableStepErrors.push(...mergedSearch.errors.map(error => `[${step.id}] ${error}`));
                }

                if (mergedSearch.results.length > 0) {
                  discoveredSourceCount += mergedSearch.results.length;

                  stepSearchResults.set(step.id, mergedSearch.results);
                  step.urls = mergedSearch.results.map(result => result.url);

                  onEvent({
                    type: 'source_summary',
                    data: {
                      scope: 'discovered',
                      delta: mergedSearch.results.length,
                      total: discoveredSourceCount,
                    },
                  });
                }
              }
              break;

            case 'crawl':
              {
                const resolvedUrls = this.resolveCrawlUrls(step, stepSearchResults);
                const validUrls = resolvedUrls.filter(url => this.isValidHttpUrl(url));
                const invalidUrls = resolvedUrls.filter(url => !this.isValidHttpUrl(url));
                const candidateUrls = validUrls.slice(0, this.MAX_CRAWL_CANDIDATES_PER_STEP);

                if (invalidUrls.length > 0) {
                  const invalidMessage = `Invalid crawl URLs skipped: ${invalidUrls.join(', ')}`;
                  recoverableStepErrors.push(`[${step.id}] ${invalidMessage}`);
                  this.logger.warn(`${step.id}: ${invalidMessage}`);
                }

                if (candidateUrls.length === 0) {
                  const noUrlMessage = `No valid URLs available for crawl step`;
                  recoverableStepErrors.push(`[${step.id}] ${noUrlMessage}`);
                  onEvent({
                    type: 'error',
                    data: {
                      phase: `step_${step.id}`,
                      error: noUrlMessage,
                      recoverable: true,
                    },
                  });
                  break;
                }

                crawlAttemptedCount += candidateUrls.length;

                const crawlResults = await this.jinaCrawlerService.crawlUrls(
                  candidateUrls,
                  { concurrency: 3 },
                  signal
                );

                crawlSuccessCount += crawlResults.filter(result => result.status === 'success').length;
                crawlFailureCount += crawlResults.filter(result => result.status !== 'success').length;

                const crawlErrors = crawlResults
                  .filter(result => result.status === 'failed' && result.error)
                  .map(result => `[${step.id}] ${result.url}: ${result.error}`);

                if (crawlErrors.length > 0) {
                  recoverableStepErrors.push(...crawlErrors);
                }

                crawlResults.forEach(result => {
                  if (result.status === 'success') {
                    operations.push(
                      CostEstimator.createCrawlUrlOperation(result.url)
                    );
                  }
                });

                const extractedContents = await this.contentExtractorService.extractFromCrawlResults(
                  crawlResults.filter(r => r.status === 'success')
                );

                const usableExtractedContents = extractedContents.filter(content => content.wordCount >= this.MIN_EXTRACTED_WORDS);
                const lowContentResults = extractedContents.filter(content => content.wordCount < this.MIN_EXTRACTED_WORDS);
                filteredLowContentCount += lowContentResults.length;

                lowContentResults.forEach(content => {
                  const lowContentMessage = `Low-content page skipped (${content.wordCount} words): ${content.url}`;
                  recoverableStepErrors.push(`[${step.id}] ${lowContentMessage}`);
                  this.logger.warn(`${step.id}: ${lowContentMessage}`);
                });

                this.appendUniqueSources(
                  sources,
                  usableExtractedContents.map(content => ({
                    url: content.url,
                    title: content.title,
                    content: content.content,
                    wordCount: content.wordCount,
                  }))
                );
                usableSourceCount = sources.length;

                if (lowContentResults.length > 0) {
                  onEvent({
                    type: 'source_summary',
                    data: {
                      scope: 'filtered_low_content',
                      delta: lowContentResults.length,
                      total: filteredLowContentCount,
                    },
                  });
                }

                if (usableExtractedContents.length > 0) {
                  onEvent({
                    type: 'source_summary',
                    data: {
                      scope: 'usable',
                      delta: usableExtractedContents.length,
                      total: usableSourceCount,
                    },
                  });
                }

                onEvent({
                  type: 'sources',
                  data: usableExtractedContents.map(c => ({
                    url: c.url,
                    title: c.title,
                    excerpt: c.excerpt,
                  })),
                });
              }
              break;

            case 'analyze':
              break;

            case 'synthesize':
              break;
          }

          onEvent({
            type: 'step_completed',
            data: { stepId: step.id },
          });
        } catch (error: any) {
          this.logger.error(`Error in step ${step.id}: ${error.message}`);
          recoverableStepErrors.push(`[${step.id}] ${error.message}`);

          onEvent({
            type: 'error',
            data: {
              phase: `step_${step.id}`,
              error: error.message,
              recoverable: true,
            },
          });
        } finally {
          completedStepIds.add(step.id);
        }
      };

      while (pendingSteps.length > 0) {
        if (signal?.aborted) {
          throw new Error('Research aborted');
        }

        executionWaveCount += 1;
        const waveStart = Date.now();

        const readySteps = pendingSteps.filter(step =>
          (step.dependencies || []).every(dep => completedStepIds.has(dep))
        );

        this.logger.log(
          `Deep research wave ${executionWaveCount} start: ready=${readySteps.length}, pending=${pendingSteps.length}, completed=${completedStepIds.size}`
        );

        if (readySteps.length === 0) {
          const forcedStep = pendingSteps.shift();
          if (!forcedStep) {
            break;
          }
          this.logger.warn(`No dependency-ready step found; forcing execution for ${forcedStep.id}`);
          await runStep(forcedStep);
          continue;
        }

        const readyStepIds = new Set(readySteps.map(step => step.id));
        for (let index = pendingSteps.length - 1; index >= 0; index--) {
          if (readyStepIds.has(pendingSteps[index].id)) {
            pendingSteps.splice(index, 1);
          }
        }

        const parallelSearchSteps = readySteps.filter(step => step.type === 'search');
        const sequentialSteps = readySteps.filter(step => step.type !== 'search');

        if (parallelSearchSteps.length > 0) {
          const settled = await Promise.allSettled(parallelSearchSteps.map(step => runStep(step)));
          const abortedResult = settled.find(
            result => result.status === 'rejected' && (result.reason?.message === 'Research aborted')
          );
          if (abortedResult && abortedResult.status === 'rejected') {
            throw abortedResult.reason;
          }
        }

        for (const step of sequentialSteps) {
          await runStep(step);
        }

        this.logger.log(
          `Deep research wave ${executionWaveCount} end: parallel_search=${parallelSearchSteps.length}, sequential=${sequentialSteps.length}, duration_ms=${Date.now() - waveStart}, remaining_pending=${pendingSteps.length}`
        );
      }

      // Phase 5: Synthesize final report
      let finalReport = '';

      if (sources.length === 0 && options.isWebSearchEnabled) {
        recoveryAttempted = true;
        onEvent({
          type: 'step_progress',
          data: {
            stepId: 'recovery',
            progress: 5,
            status: 'Starting recovery pass',
          },
        });

        recoveryQueriesTried = await this.generateRecoveryQueries(messages, recoverableStepErrors, signal);

        for (let index = 0; index < recoveryQueriesTried.length; index++) {
          const recoveryQuery = recoveryQueriesTried[index];

          if (signal?.aborted) {
            throw new Error('Research aborted');
          }

          onEvent({
            type: 'step_progress',
            data: {
              stepId: 'recovery',
              progress: Math.min(90, 10 + Math.floor((index / Math.max(recoveryQueriesTried.length, 1)) * 80)),
              status: `Recovery query ${index + 1}/${recoveryQueriesTried.length}: ${recoveryQuery}`,
            },
          });

          try {
            const recoverySearch = await this.searchAndMergeWebSources(recoveryQuery, this.MAX_RECOVERY_URLS_PER_QUERY);
            operations.push(CostEstimator.createWebSearchOperation(recoveryQuery));
            operations.push(CostEstimator.createWebSearchOperation(recoveryQuery));

            if (recoverySearch.provider.tavilyHit) {
              tavilyDiscoveryHits += 1;
            }
            if (recoverySearch.provider.serperHit) {
              serperSearchQueries += 1;
            }

            if (recoverySearch.errors.length > 0) {
              recoverableStepErrors.push(...recoverySearch.errors.map(error => `[recovery] ${error}`));
            }

            const recoveryResults = recoverySearch.results;
            discoveredSourceCount += recoveryResults.length;

            if (recoveryResults.length > 0) {
              onEvent({
                type: 'source_summary',
                data: {
                  scope: 'discovered',
                  delta: recoveryResults.length,
                  total: discoveredSourceCount,
                },
              });
            }

            const recoveryUrls = recoveryResults
              .map(result => result.url)
              .slice(0, this.MAX_RECOVERY_URLS_PER_QUERY);
            if (recoveryUrls.length === 0) {
              recoverableStepErrors.push(`[recovery] No valid URLs from recovery query: ${recoveryQuery}`);
              continue;
            }

            crawlAttemptedCount += recoveryUrls.length;

            const recoveryCrawlResults = await this.jinaCrawlerService.crawlUrls(
              recoveryUrls,
              { concurrency: 3 },
              signal
            );

            crawlSuccessCount += recoveryCrawlResults.filter(result => result.status === 'success').length;
            crawlFailureCount += recoveryCrawlResults.filter(result => result.status !== 'success').length;

            const recoveryCrawlErrors = recoveryCrawlResults
              .filter(result => result.status === 'failed' && result.error)
              .map(result => `[recovery] ${result.url}: ${result.error}`);

            if (recoveryCrawlErrors.length > 0) {
              recoverableStepErrors.push(...recoveryCrawlErrors);
            }

            recoveryCrawlResults.forEach(result => {
              if (result.status === 'success') {
                operations.push(CostEstimator.createCrawlUrlOperation(result.url));
              }
            });

            const extractedContents = await this.contentExtractorService.extractFromCrawlResults(
              recoveryCrawlResults.filter(result => result.status === 'success')
            );

            const usableExtractedContents = extractedContents.filter(content => content.wordCount >= this.MIN_EXTRACTED_WORDS);
            const lowContentResults = extractedContents.filter(content => content.wordCount < this.MIN_EXTRACTED_WORDS);
            filteredLowContentCount += lowContentResults.length;

            lowContentResults.forEach(content => {
              const lowContentMessage = `Low-content recovery page skipped (${content.wordCount} words): ${content.url}`;
              recoverableStepErrors.push(`[recovery] ${lowContentMessage}`);
              this.logger.warn(lowContentMessage);
            });

            this.appendUniqueSources(
              sources,
              usableExtractedContents.map(content => ({
                url: content.url,
                title: content.title,
                content: content.content,
                wordCount: content.wordCount,
              }))
            );
            usableSourceCount = sources.length;

            recoveryRecoveredSources += usableExtractedContents.length;

            if (lowContentResults.length > 0) {
              onEvent({
                type: 'source_summary',
                data: {
                  scope: 'filtered_low_content',
                  delta: lowContentResults.length,
                  total: filteredLowContentCount,
                },
              });
            }

            if (usableExtractedContents.length > 0) {
              onEvent({
                type: 'source_summary',
                data: {
                  scope: 'usable',
                  delta: usableExtractedContents.length,
                  total: usableSourceCount,
                },
              });
            }

            if (usableExtractedContents.length > 0) {
              onEvent({
                type: 'sources',
                data: usableExtractedContents.map(content => ({
                  url: content.url,
                  title: content.title,
                  excerpt: content.excerpt,
                })),
              });
            }
          } catch (recoveryError: any) {
            recoverableStepErrors.push(`[recovery] ${recoveryError.message}`);
            onEvent({
              type: 'error',
              data: {
                phase: 'recovery',
                error: recoveryError.message,
                recoverable: true,
              },
            });
          }
        }

        onEvent({
          type: 'step_progress',
          data: {
            stepId: 'recovery',
            progress: 100,
            status: sources.length > 0
              ? `Recovery completed with ${recoveryRecoveredSources} recovered source(s)`
              : 'Recovery completed without usable sources',
          },
        });
      }

      if (sources.length > 0) {
        await this.generateReport(
          messages,
          sources,
          plan,
          (chunk) => {
            finalReport += chunk;
            onEvent({
              type: 'chunk',
              data: chunk,
            });
          },
          options.templateId,
          signal
        );

        const minCitationTarget = this.resolveMinCitationTarget(sources.length);
        finalReport = this.ensureMinimumCitations(finalReport, sources, minCitationTarget);
        finalReport = this.normalizeKeyCitationsLineBreaks(finalReport);
      } else {
        finalReport = this.buildNoSourcesReport({
          query: messages[messages.length - 1]?.content || '',
          discoveredSourceCount,
          crawlAttemptedCount,
          crawlSuccessCount,
          crawlFailureCount,
          recoverableStepErrors,
          recoveryAttempted,
          recoveryRecoveredSources,
          recoveryQueriesTried,
        });

        onEvent({
          type: 'chunk',
          data: finalReport,
        });
      }

      // Calculate actual usage and update quota
      const actualUsage = {
        researchRequests: 1,
        webSearches: operations.filter(op => op.operationType === 'web_search').length,
        crawlUrls: operations.filter(op => op.operationType === 'crawl_url').length,
        llmTokens: 0, // Will be calculated from LLM operations
        cost: CostEstimator.calculateActualCost(operations),
      };

      await this.quotaService.consumeQuota(options.workspaceId, actualUsage);

      // Update research session as completed
      await this.researchSessionRepo.complete(researchSessionId, {
        finalReport: finalReport || 'Report generated successfully',
        webSearchesCount: actualUsage.webSearches,
        crawlUrlsCount: actualUsage.crawlUrls,
        llmInputTokens: 0,
        llmOutputTokens: 0,
      });

      const result: ResearchResult = {
        success: true,
        report: finalReport,
        sources,
        researchSessionId,
        totalCost: actualUsage.cost,
        metrics: {
          discoveredCandidates: discoveredSourceCount,
          usableSources: sources.length,
          filteredLowContent: filteredLowContentCount,
          citedSources: this.countDistinctCitations(finalReport),
          crawlAttempted: crawlAttemptedCount,
          crawlSuccess: crawlSuccessCount,
          crawlFailed: crawlFailureCount,
        },
      };

      onEvent({
        type: 'complete',
        data: result,
      });

      this.log(`Deep research completed in ${Date.now() - startTime}ms`);
      this.logger.log(
        `Deep research telemetry: waves=${executionWaveCount}, tavily_discovery_hits=${tavilyDiscoveryHits}, serper_queries=${serperSearchQueries}, discovered_candidates=${discoveredSourceCount}, usable_sources=${sources.length}, filtered_low_content=${filteredLowContentCount}, cited_sources=${this.countDistinctCitations(finalReport)}, crawl_attempted=${crawlAttemptedCount}, crawl_success=${crawlSuccessCount}, crawl_failed=${crawlFailureCount}`
      );

      return result;
    } catch (error: any) {
      if (error.message === 'CLARIFICATION_NEEDED') {
        this.log('Deep research paused: clarification needed');
        throw error;
      }

      this.logger.error(`Deep research failed: ${error.message}`);

      if (researchSessionId) {
        await this.researchSessionRepo.fail(researchSessionId, error.message);
      }

      onEvent({
        type: 'error',
        data: {
          phase: 'research',
          error: error.message,
          recoverable: false,
        },
      });

      throw error;
    }
  }

  private buildNoSourcesReport(input: {
    query: string;
    discoveredSourceCount: number;
    crawlAttemptedCount: number;
    crawlSuccessCount: number;
    crawlFailureCount: number;
    recoverableStepErrors: string[];
    recoveryAttempted: boolean;
    recoveryRecoveredSources: number;
    recoveryQueriesTried: string[];
  }): string {
    const {
      query,
      discoveredSourceCount,
      crawlAttemptedCount,
      crawlSuccessCount,
      crawlFailureCount,
      recoverableStepErrors,
      recoveryAttempted,
      recoveryRecoveredSources,
      recoveryQueriesTried,
    } = input;

    const errorLines = recoverableStepErrors.length > 0
      ? recoverableStepErrors.slice(0, 5).map(error => `- ${error}`).join('\n')
      : '- No explicit step errors were captured; sources were unavailable after crawling.';

    const recoverySection = recoveryAttempted
      ? `- Recovery queries tried: ${recoveryQueriesTried.length > 0 ? recoveryQueriesTried.join(' | ') : 'none'}\n- Sources recovered during recovery: ${recoveryRecoveredSources}`
      : '';

    return `# ${query || 'Research Report'}\n\n## Key Points\n- No crawlable source content was extracted for synthesis.\n- Candidate web results discovered: ${discoveredSourceCount}.\n- URLs attempted for crawling: ${crawlAttemptedCount}.\n- Successful crawls: ${crawlSuccessCount}; failed crawls: ${crawlFailureCount}.\n${recoverySection || '- Recovery pass was not executed.'}\n\n## Overview\nThis run could not produce a full synthesized answer because no usable source content was extracted from crawled pages.\n\nThe current result is a process summary and recovery guidance rather than a source-grounded analysis.\n\n## Detailed Analysis\n### Extraction Outcome\n${errorLines}\n\n### Next Actions\n- Narrow or rephrase the query to target specific domains or documents.\n- Retry with fewer but higher-quality URLs.\n- Provide internal pages/documents to supplement missing web content.\n- Try again later if target websites were temporarily unavailable.\n\n## Key Citations\n- No usable citations were available for this run.`;
  }

  private async generateRecoveryQueries(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    recoverableStepErrors: string[],
    signal?: AbortSignal
  ): Promise<string[]> {
    const userQuery = messages[messages.length - 1]?.content || '';
    const recentErrors = recoverableStepErrors.slice(-3).join('\n');

    const prompt = `You are helping recover a failed web research pass.

Original query:
${userQuery}

Recent crawl/search issues:
${recentErrors || 'No explicit errors provided'}

Generate 1 concise fallback web search query that maximizes chance of crawlable, public sources.
Rules:
- Prioritize authoritative, indexable sources.
- Avoid paywalled-heavy wording.
- Return ONLY the query, no numbering.`;

    try {
      const provider = this.orchestrator.getProvider('glm-4.5');
      const response = await provider.generateText('', prompt, 'glm-4.5', signal);

      const queries = response
        .split('\n')
        .map(line => line.trim())
        .map(line => line.replace(/^[-*0-9.\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 1);

      if (queries.length > 0) {
        return queries;
      }
    } catch (error: any) {
      this.logger.warn(`Failed to generate recovery queries via LLM: ${error.message}`);
    }

    const fallback = userQuery || 'current topic';
    return [`${fallback} overview explanation site:wikipedia.org`];
  }

  private applyLightResearchProfile(plan: ResearchPlan): ResearchPlan {
    const maxSteps = 6;
    const trimmedSteps = (plan.steps || []).slice(0, maxSteps);
    const validStepIds = new Set(trimmedSteps.map(step => step.id));

    const normalizedSteps = trimmedSteps.map(step => ({
      ...step,
      dependencies: (step.dependencies || []).filter(dep => validStepIds.has(dep)),
      urls: step.urls?.slice(0, this.MAX_CRAWL_CANDIDATES_PER_STEP),
    }));

    const estimatedSources = Math.max(3, Math.min(plan.estimatedSources || normalizedSteps.length * 2, 8));

    return {
      ...plan,
      steps: normalizedSteps,
      estimatedSources,
      estimatedTime: normalizedSteps.length <= 4 ? '2-3 minutes' : '3-5 minutes',
      estimatedCost: Math.min(plan.estimatedCost || 0.15, 0.2),
    };
  }

  private resolveCrawlUrls(
    step: ResearchPlan['steps'][number],
    stepSearchResults: Map<string, Array<{ url: string; title: string; excerpt: string }>>
  ): string[] {
    const directUrls = (step.urls || []).filter(url => !!url && !this.isPlaceholderUrl(url));

    if (directUrls.length > 0) {
      return [...new Set(directUrls)];
    }

    const dependencyUrls = (step.dependencies || [])
      .flatMap(dependency => stepSearchResults.get(dependency)?.map(result => result.url) || [])
      .filter(url => !!url);

    return [...new Set(dependencyUrls)];
  }

  private async searchAndMergeWebSources(
    query: string,
    limit: number
  ): Promise<{
    results: Array<{ url: string; title: string; excerpt: string }>;
    provider: { tavilyHit: boolean; serperHit: boolean };
    errors: string[];
  }> {
    const [tavilySettled, serperSettled] = await Promise.allSettled([
      this.tavilyResearchService.search(query),
      this.webSearchService.search(query),
    ]);

    const errors: string[] = [];

    const tavilyRaw = tavilySettled.status === 'fulfilled'
      ? tavilySettled.value.results
          .filter(result => this.isValidHttpUrl(result.url))
          .map((result, index) => ({
            url: result.url,
            title: result.title,
            excerpt: this.toExcerpt(result.content),
            provider: 'tavily' as const,
            rank: index,
          }))
      : [];

    if (tavilySettled.status === 'rejected') {
      errors.push(`Tavily search failed: ${tavilySettled.reason?.message || 'unknown error'}`);
    } else if (tavilySettled.value.error) {
      errors.push(`Tavily search warning: ${tavilySettled.value.error}`);
    }

    const serperRaw = serperSettled.status === 'fulfilled'
      ? serperSettled.value.results
          .filter(result => this.isValidHttpUrl(result.url))
          .map((result, index) => ({
            url: result.url,
            title: result.title,
            excerpt: this.toExcerpt(result.content),
            provider: 'serper' as const,
            rank: index,
          }))
      : [];

    if (serperSettled.status === 'rejected') {
      errors.push(`Serper search failed: ${serperSettled.reason?.message || 'unknown error'}`);
    } else if (serperSettled.value.error) {
      errors.push(`Serper search warning: ${serperSettled.value.error}`);
    }

    const mergedMap = new Map<string, {
      url: string;
      title: string;
      excerpt: string;
      score: number;
      providers: Set<'tavily' | 'serper'>;
    }>();

    const addResult = (item: { url: string; title: string; excerpt: string; provider: 'tavily' | 'serper'; rank: number }) => {
      const key = this.canonicalizeSearchUrl(item.url);
      if (!key) {
        return;
      }

      const existing = mergedMap.get(key);
      const baseScore = 20 - item.rank;

      if (!existing) {
        mergedMap.set(key, {
          url: item.url,
          title: item.title,
          excerpt: item.excerpt,
          score: baseScore,
          providers: new Set([item.provider]),
        });
        return;
      }

      existing.score += baseScore;
      if (!existing.providers.has(item.provider)) {
        existing.providers.add(item.provider);
        existing.score += 10;
      }

      if ((item.excerpt || '').length > (existing.excerpt || '').length) {
        existing.excerpt = item.excerpt;
      }
      if ((item.title || '').length > (existing.title || '').length) {
        existing.title = item.title;
      }
    };

    [...tavilyRaw, ...serperRaw].forEach(addResult);

    const results = Array.from(mergedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        url: item.url,
        title: item.title,
        excerpt: item.excerpt,
      }));

    return {
      results,
      provider: {
        tavilyHit: tavilyRaw.length > 0,
        serperHit: serperRaw.length > 0,
      },
      errors,
    };
  }

  private canonicalizeSearchUrl(value: string): string {
    try {
      const parsed = new URL(value);
      parsed.hash = '';

      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
      paramsToRemove.forEach(param => parsed.searchParams.delete(param));

      let pathname = parsed.pathname || '/';
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      const host = parsed.host.toLowerCase();
      const search = parsed.searchParams.toString();
      return `${parsed.protocol}//${host}${pathname}${search ? `?${search}` : ''}`;
    } catch {
      return '';
    }
  }

  private isPlaceholderUrl(value: string): boolean {
    const normalized = value.toLowerCase();
    return normalized.includes('[urls from') || normalized.includes('urls from step');
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private appendUniqueSources(
    sources: Array<{ url: string; title: string; content: string; wordCount: number }>,
    incoming: Array<{ url: string; title: string; content: string; wordCount: number }>
  ): void {
    const existingUrls = new Set(sources.map(source => source.url));

    incoming.forEach(source => {
      if (!existingUrls.has(source.url)) {
        sources.push(source);
        existingUrls.add(source.url);
      }
    });
  }

  private toExcerpt(content: string, maxLength = 320): string {
    if (!content) {
      return '';
    }

    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength).trimEnd()}...`;
  }

  private calculateWordCount(content: string): number {
    const text = content?.trim();
    if (!text) {
      return 0;
    }

    return text.split(/\s+/).filter(Boolean).length;
  }

  private resolveMinCitationTarget(usableSources: number): number {
    if (usableSources <= 0) {
      return 0;
    }

    return Math.min(this.MIN_CITATION_TARGET, usableSources);
  }

  private countDistinctCitations(report: string): number {
    if (!report) {
      return 0;
    }

    const citations = new Set<number>();
    const matches = report.matchAll(/\[\^(\d+)\]/g);

    for (const match of matches) {
      const index = Number(match[1]);
      if (Number.isFinite(index) && index > 0) {
        citations.add(index);
      }
    }

    return citations.size;
  }

  private ensureMinimumCitations(
    report: string,
    sources: Array<{ url: string; title: string; content: string; wordCount: number }>,
    minCitationTarget: number
  ): string {
    if (!report || minCitationTarget <= 0) {
      return report;
    }

    const presentCitationIndexes = new Set<number>();
    for (const match of report.matchAll(/\[\^(\d+)\]/g)) {
      const index = Number(match[1]);
      if (Number.isFinite(index) && index > 0) {
        presentCitationIndexes.add(index);
      }
    }

    if (presentCitationIndexes.size >= minCitationTarget) {
      return report;
    }

    const missingIndexes: number[] = [];
    for (let index = 1; index <= Math.min(sources.length, minCitationTarget); index++) {
      if (!presentCitationIndexes.has(index)) {
        missingIndexes.push(index);
      }
    }

    if (missingIndexes.length === 0) {
      return report;
    }

    const missingCitationLines = missingIndexes
      .map(index => {
        const source = sources[index - 1];
        if (!source) {
          return '';
        }

        return `[^${index}] ${source.title}. ${source.url}`;
      })
      .filter(Boolean)
      .join('\n');

    const normalizedReport = report.trimEnd();
    const hasKeyCitationsHeading = /(^|\n)##\s+Key Citations\b/i.test(normalizedReport);

    this.logger.warn(
      `Citation coverage below target: present=${presentCitationIndexes.size}, target=${minCitationTarget}. Appending missing citations.`
    );

    if (hasKeyCitationsHeading) {
      return `${normalizedReport}\n${missingCitationLines}\n`;
    }

    return `${normalizedReport}\n\n## Key Citations\n${missingCitationLines}\n`;
  }

  /**
   * Continue research after clarification
   */
  async continueAfterClarification(
    options: DeepResearchOptions,
    clarificationAnswer: string,
    onEvent: (event: ResearchEvent) => void,
    signal?: AbortSignal
  ): Promise<ResearchResult> {
    // Add clarification answer to messages
    const updatedOptions = {
      ...options,
      messages: [...options.messages, { role: 'user' as const, content: clarificationAnswer }],
      clarificationRound: (options.clarificationRound || 0) + 1,
    };

    return this.execute(updatedOptions, onEvent, signal);
  }

  async validatePlanContinuation(input: {
    researchSessionId: string;
    workspaceId: string;
    userId: string;
    expectedPlanHash?: string;
    approvedPlan?: ResearchPlan;
  }): Promise<ResearchSessionAudit> {
    const session = await this.researchSessionRepo.findById(input.researchSessionId);

    if (!session) {
      throw new Error('Research session not found');
    }

    if (session.workspaceId !== input.workspaceId || session.userId !== input.userId) {
      throw new Error('Research session access denied');
    }

    if (session.status === 'in_progress' || session.status === 'completed') {
      return {
        researchSessionId: input.researchSessionId,
        status: session.status,
        approvedAt: session.approvedAt?.toISOString(),
        approvedById: session.approvedById,
        approvedPlanHash: session.approvedPlanHash,
        completedAt: session.completedAt?.toISOString(),
      };
    }

    if (session.status !== 'awaiting_approval') {
      throw new Error(`Research session is not awaiting approval or in progress (status: ${session.status})`);
    }

    const planToValidate = input.approvedPlan || session.plan;
    if (!planToValidate || !planToValidate.steps || planToValidate.steps.length === 0) {
      throw new Error('No valid approved plan found for continuation');
    }

    const currentPlanHash = this.hashResearchPlan(planToValidate);
    if (input.expectedPlanHash && currentPlanHash !== input.expectedPlanHash) {
      throw new Error('Plan has changed since it was shown. Please review the latest plan before approving.');
    }

    this.ensurePlanIsExecutable(planToValidate);

    const approvedAt = new Date();

    await this.researchSessionRepo.update(input.researchSessionId, {
      plan: planToValidate,
      status: 'in_progress',
      approvedAt,
      approvedById: input.userId,
      approvedPlanHash: currentPlanHash,
    });

    return {
      researchSessionId: input.researchSessionId,
      status: 'in_progress',
      approvedAt: approvedAt.toISOString(),
      approvedById: input.userId,
      approvedPlanHash: currentPlanHash,
    };
  }

  private hashResearchPlan(plan: ResearchPlan): string {
    const payload = JSON.stringify(plan);
    return createHash('sha256').update(payload).digest('hex');
  }

  private ensurePlanIsExecutable(plan: ResearchPlan): void {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Invalid research plan: no steps generated');
    }

    const allowedStepTypes = new Set(['search', 'crawl', 'analyze', 'synthesize']);
    const stepIds = new Set<string>();

    for (const step of plan.steps) {
      if (!step?.id || !step.title || !step.description) {
        throw new Error('Invalid research plan: step id/title/description is required');
      }

      if (!allowedStepTypes.has(step.type)) {
        throw new Error(`Invalid research plan: unsupported step type "${step.type}"`);
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Invalid research plan: duplicate step id "${step.id}"`);
      }

      stepIds.add(step.id);
    }

    const hasExecutableStep = plan.steps.some(step => ['search', 'crawl', 'analyze', 'synthesize'].includes(step.type));
    if (!hasExecutableStep) {
      throw new Error('Invalid research plan: no executable steps found');
    }

    for (const step of plan.steps) {
      for (const dependency of step.dependencies || []) {
        if (!stepIds.has(dependency)) {
          throw new Error(`Invalid research plan: dependency "${dependency}" not found`);
        }
      }
    }
  }

  async rejectPlanContinuation(input: {
    researchSessionId: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    const session = await this.researchSessionRepo.findById(input.researchSessionId);

    if (!session) {
      throw new Error('Research session not found');
    }

    if (session.workspaceId !== input.workspaceId || session.userId !== input.userId) {
      throw new Error('Research session access denied');
    }

    if (session.status !== 'awaiting_approval') {
      throw new Error(`Research session is not awaiting approval (status: ${session.status})`);
    }

    await this.researchSessionRepo.update(input.researchSessionId, {
      status: 'cancelled',
      errorMessage: 'Plan rejected by user',
      completedAt: new Date(),
    });
  }

  async getSessionAudit(input: {
    researchSessionId: string;
    workspaceId: string;
    userId: string;
  }): Promise<ResearchSessionAudit> {
    const session = await this.researchSessionRepo.findById(input.researchSessionId);

    if (!session) {
      throw new Error('Research session not found');
    }

    if (session.workspaceId !== input.workspaceId || session.userId !== input.userId) {
      throw new Error('Research session access denied');
    }

    return {
      researchSessionId: session.id,
      status: session.status,
      approvedAt: session.approvedAt?.toISOString(),
      approvedById: session.approvedById,
      approvedPlanHash: session.approvedPlanHash,
      completedAt: session.completedAt?.toISOString(),
    };
  }

  /**
   * Generate final report from sources
   */
  private async generateReport(
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    sources: Array<{
      url: string;
      title: string;
      content: string;
      wordCount: number;
    }>,
    plan: ResearchPlan,
    onChunk: (chunk: string) => void,
    templateId?: string,
    signal?: AbortSignal
  ): Promise<void> {
    const template = getDeepResearchTemplate(templateId);

    // Build context from sources
    const context = sources
      .map((source, index) => {
        const truncatedContent = source.content.substring(0, 4000);
        return `[Source ${index + 1}] (URL: ${source.url}, Title: "${source.title}"):\n"${truncatedContent}"`;
      })
      .join('\n\n');

    const userQuery = messages[messages.length - 1].content;

    const systemPrompt = `You are a research analyst tasked with creating a comprehensive report based on the provided sources. Your report must follow the exact structure and citation rules below.

  TEMPLATE:
  ${template.label}

RESEARCH PLAN:
Title: ${plan.title}
Description: ${plan.description}

USER QUERY:
${userQuery}

SOURCES:
${context}

${template.reportStructure}

${template.reportRequirements}

${template.citationRules}`;

    const provider = this.orchestrator.getProvider('glm-4.7-flash');

    await provider.streamText(
      systemPrompt,
      `Generate a comprehensive research report based on the sources above that addresses the user's query: "${userQuery}"`,
      onChunk,
      () => {},
      'glm-4.7-flash',
      undefined,
      signal
    );
  }

  private normalizeKeyCitationsLineBreaks(report: string): string {
    if (!report) {
      return report;
    }

    const headingMatch = report.match(/(^|\n)##\s+Key Citations\b[^\n]*\n?/i);
    if (!headingMatch || headingMatch.index === undefined) {
      return report;
    }

    const sectionStart = headingMatch.index + headingMatch[1].length;
    const heading = headingMatch[0].trimEnd();
    const before = report.slice(0, sectionStart);
    const body = report.slice(sectionStart + heading.length).trim();

    if (!body) {
      return `${before}${heading}\n`;
    }

    const normalizedBody = body
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+(?=\[\^\d+\])/g, '\n')
      .replace(/\s+(?=\d+\s+[A-Z][^\n]*?\.\s+https?:\/\/)/g, '\n')
      .trim();

    return `${before}${heading}\n${normalizedBody}\n`;
  }

  /**
   * Log debug message
   */
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      this.logger.log(message, ...args);
    }
  }

  private deriveSessionTitleFromText(value: string): string {
    const normalized = (value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return this.DEFAULT_SESSION_TITLE;
    }

    return normalized.slice(0, this.MAX_SESSION_TITLE_LENGTH);
  }

  private async tryUpdateSessionTitle(
    sessionId: string | undefined,
    candidateTitle: string,
    allowedCurrentTitles: string[]
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    const nextTitle = this.deriveSessionTitleFromText(candidateTitle);
    if (nextTitle === this.DEFAULT_SESSION_TITLE) {
      return;
    }

    const session = await this.aiSessionRepo.findById(sessionId);
    if (!session) {
      return;
    }

    const normalizedAllowedTitles = new Set(
      allowedCurrentTitles
        .map(title => this.deriveSessionTitleFromText(title))
        .filter(Boolean)
    );

    if (!normalizedAllowedTitles.has(this.deriveSessionTitleFromText(session.title))) {
      return;
    }

    await this.aiSessionRepo.updateTitle(sessionId, nextTitle);
  }
}