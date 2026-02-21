import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../common/decorators/auth-workspace.decorator';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { RagService } from './services/rag.service';
import { AiSessionRepo } from './repos/ai-session.repo';
import { AiMessageRepo } from './repos/ai-message.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AiGenerateDto } from './dto/ai-generate.dto';
import { AiChatDto } from './dto/ai-chat.dto';
import { AiPageSearchDto } from './dto/ai-page-search.dto';
import { CreateAiSessionDto, UpdateAiSessionTitleDto, AiSessionResponseDto, AiMessageResponseDto } from './dto/ai-session.dto';
import { buildEditorSystemPrompt } from './utils/prompt.utils';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly ragService: RagService,
    private readonly sessionRepo: AiSessionRepo,
    private readonly messageRepo: AiMessageRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  // ── Configuration guard helper ────────────────────────────────────────────

  private ensureConfigured(): void {
    if (!this.orchestrator.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured. Set AI_DRIVER and related environment variables.',
      );
    }
  }

  // ── Helper mappers ──────────────────────────────────────────────────────

  private mapSessionToResponse(session: any): AiSessionResponseDto {
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      pageId: session.pageId,
      userId: session.userId,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private mapMessageToResponse(message: any): AiMessageResponseDto {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      sources: message.sources,
      createdAt: message.createdAt.toISOString(),
    };
  }

  // ── AI status endpoint (frontend gating) ─────────────────────────────────

  /**
   * Returns whether AI is configured and available.
   * The frontend uses this to decide whether to show the AI sparkles button.
   */
  @Get('status')
  @HttpCode(200)
  getStatus() {
    return { configured: this.orchestrator.isConfigured() };
  }

  // ── Session CRUD ─────────────────────────────────────────────────────────────

  /**
   * Get all sessions for the current user in the workspace.
   */
  @Get('sessions')
  async getSessions(
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<AiSessionResponseDto[]> {
    const sessions = await this.sessionRepo.findByWorkspaceAndUser(
      workspace.id,
      user.id,
    );
    return sessions.map((s) => this.mapSessionToResponse(s));
  }

  /**
   * Create a new session.
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateAiSessionDto,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<AiSessionResponseDto> {
    const title = 'New Chat';
    const session = await this.sessionRepo.create({
      workspaceId: workspace.id,
      userId: user.id,
      pageId: dto.pageId,
      title,
    });
    return this.mapSessionToResponse(session);
  }

  /**
   * Get a specific session with its messages.
   */
  @Get('sessions/:id')
  async getSession(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<{ session: AiSessionResponseDto; messages: AiMessageResponseDto[] }> {
    const session = await this.sessionRepo.findById(id);
    if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
      throw new NotFoundException('Session not found');
    }
    const messages = await this.messageRepo.findBySessionId(id);
    return {
      session: this.mapSessionToResponse(session),
      messages: messages.map((m) => this.mapMessageToResponse(m)),
    };
  }

  /**
   * Delete a session.
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  async deleteSession(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<void> {
    const session = await this.sessionRepo.findById(id);
    if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
      throw new NotFoundException('Session not found');
    }
    await this.sessionRepo.delete(id);
  }

  /**
   * Update session title.
   */
  @Patch('sessions/:id')
  async updateSessionTitle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiSessionTitleDto,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<AiSessionResponseDto> {
    const session = await this.sessionRepo.findById(id);
    if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
      throw new NotFoundException('Session not found');
    }
    await this.sessionRepo.updateTitle(id, dto.title);
    const updated = await this.sessionRepo.findById(id);
    return this.mapSessionToResponse(updated);
  }

  /**
   * Automatically generate and update session title.
   */
  @Post('sessions/:id/auto-title')
  async autoTitle(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ) {
    const session = await this.sessionRepo.findById(id);
    if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
      throw new NotFoundException('Session not found');
    }

    // Only rename if it's still the default title
    if (session.title !== 'New Chat') {
      return this.mapSessionToResponse(session);
    }

    const messages = await this.messageRepo.findBySessionId(id);
    const firstUserMessage = messages.find((m) => m.role === 'user');

    if (!firstUserMessage) {
      return this.mapSessionToResponse(session);
    }

    try {
      const titlePrompt = `Summarize the following question/statement in 5 words or fewer, return only the short title with no punctuation:\n\n${firstUserMessage.content}`;
      const provider = this.orchestrator.getProvider('glm-4.5');
      const generatedTitle = await provider.generateText('', titlePrompt, 'glm-4.5');
      const cleanTitle = generatedTitle.trim().slice(0, 60);

      await this.sessionRepo.updateTitle(id, cleanTitle);
      const updated = await this.sessionRepo.findById(id);
      return this.mapSessionToResponse(updated);
    } catch (e) {
      console.warn('Auto-rename failed:', e);
      return this.mapSessionToResponse(session);
    }
  }

  /**
   * Add a message to a session.
   */
  @Post('sessions/:id/messages')
  async createMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { role: 'user' | 'assistant'; content: string; sources?: any[] },
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ): Promise<AiMessageResponseDto> {
    const session = await this.sessionRepo.findById(id);
    if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
      throw new NotFoundException('Session not found');
    }

    const message = await this.messageRepo.create({
      sessionId: id,
      workspaceId: workspace.id,
      role: dto.role,
      content: dto.content,
      sources: dto.sources,
    });

    await this.sessionRepo.touch(id);

    return this.mapMessageToResponse(message);
  }

  // ── Editor actions ───────────────────────────────────────────────────────

  /** Non-streaming: used by the editor AI menu for quick actions */
  @Post('generate')
  async generate(@Body() dto: AiGenerateDto, @AuthUser() _user: any) {
    this.ensureConfigured();
    const systemPrompt = buildEditorSystemPrompt(dto.action, dto.prompt);
    const content = await this.orchestrator
      .getProvider(dto.model)
      .generateText(systemPrompt, dto.content, dto.model);
    return { content };
  }

  /** Streaming: used by the editor AI menu for live preview */
  @Post('generate/stream')
  async streamGenerate(
    @Body() dto: AiGenerateDto,
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() _user: any,
  ) {
    this.ensureConfigured();

    // MUST call hijack() first — prevents Fastify from sending its own response
    // after this async handler resolves and corrupting the stream.
    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemPrompt = buildEditorSystemPrompt(dto.action, dto.prompt);

    try {
      await this.orchestrator.getProvider(dto.model).streamText(
        systemPrompt,
        dto.content,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        dto.model,
        (err: Error) => {
          console.error('AI stream error:', err);
        },
        req.raw.signal,
      );
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ── RAG chat (citation-enabled) ──────────────────────────────────────────

  /**
   * Streaming RAG chat endpoint.
   * Flow:
   *   1. Retrieve top-K relevant chunks (pgvector similarity search)
   *   2. Emit sources event immediately so the frontend can render citations
   *   3. Stream the LLM answer with [^n] citation markers
   *   4. Persist messages to DB if sessionId is provided
   */
  @Post('chat/stream')
  async streamChat(
    @Body() dto: AiChatDto,
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ) {
    this.ensureConfigured();

    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let collectedContent = '';
    let collectedSources: any[] = [];
    let collectedThinking = '';
    let streamError: Error | null = null;

    try {
      // Step 1: retrieve relevant chunks - either from selected pages or RAG
      const lastMessage = dto.messages[dto.messages.length - 1];
      let chunks;

      if (dto.selectedPageIds && dto.selectedPageIds.length > 0) {
        chunks = await this.ragService.retrieveSelectedPages(
          dto.selectedPageIds,
          workspace.id,
        );
      } else {
        chunks = await this.ragService.retrieve(
          lastMessage.content,
          workspace.id,
        );
      }

      // Store sources for persistence
      collectedSources = chunks.map((c: any) => ({
        pageId: c.pageId,
        title: c.title,
        slugId: c.slugId,
        spaceSlug: c.spaceSlug,
        excerpt: c.excerpt,
        similarity: c.similarity,
      }));

      // Step 2: emit sources immediately — frontend renders citation popovers before answer
      res.write(
        `data: ${JSON.stringify({ type: 'sources', data: chunks })}\n\n`,
      );

      // Step 3: stream the LLM answer
      await this.orchestrator.getProvider(dto.model).streamChat(
        dto.messages,
        chunks,
        (chunk) => {
          collectedContent += chunk;
          res.write(
            `data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`,
          );
        },
        async () => {
          // Step 4: persist messages if sessionId is provided
          if (dto.sessionId) {
            try {
              // Verify session ownership before persisting
              const session = await this.sessionRepo.findById(dto.sessionId);
              if (!session || session.workspaceId !== workspace.id || session.userId !== user.id) {
                console.warn('Session not found or unauthorized for message persistence');
              } else {
                // Persist user message
                await this.messageRepo.create({
                  sessionId: dto.sessionId,
                  workspaceId: workspace.id,
                  role: 'user',
                  content: lastMessage.content,
                  sources: [],
                });
                // Persist assistant message
                await this.messageRepo.create({
                  sessionId: dto.sessionId,
                  workspaceId: workspace.id,
                  role: 'assistant',
                  content: collectedContent,
                  sources: collectedSources,
                });
                // Update session with selected page IDs if provided
                if (dto.selectedPageIds && dto.selectedPageIds.length > 0) {
                  await this.sessionRepo.updateSelectedPageIds(
                    dto.sessionId,
                    dto.selectedPageIds,
                  );
                }
                // Touch session to update updatedAt
                await this.sessionRepo.touch(dto.sessionId);
              }
            } catch (persistError: any) {
              // Log but don't fail the response
              console.error('Failed to persist chat messages:', persistError);
            }
          }
          res.write('data: [DONE]\n\n');
          res.end();
        },
        dto.model,
        dto.thinking,
        (thinking) => {
          collectedThinking += thinking;
          res.write(
            `data: ${JSON.stringify({ type: 'thinking', data: thinking })}\n\n`,
          );
        },
        (error: Error) => {
          streamError = error;
          console.error('AI stream error:', error);
        },
        req.raw.signal,
      );
    } catch (err: any) {
      // Only send error event if we haven't already sent sources
      if (!collectedSources.length) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`,
        );
      } else if (streamError) {
        // Error happened during streaming
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: streamError.message })}\n\n`,
        );
      }
      res.end();
    }
  }

  // ── Legacy compatibility endpoint (used by existing ee/ai/services) ─────

  /**
   * Existing frontend calls /api/ai/answers — keep this endpoint working.
   * Internally delegates to streamChat logic.
   */
  @Post('answers')
  async streamAnswers(
    @Body() dto: { query: string },
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() _user: any,
    @AuthWorkspace() workspace: any,
  ) {
    this.ensureConfigured();

    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    try {
      const chunks = await this.ragService.retrieve(dto.query, workspace.id);
      res.write(`data: ${JSON.stringify({ sources: chunks })}\n\n`);

      await this.orchestrator.getProvider().streamChat(
        [{ role: 'user', content: dto.query }],
        chunks,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        req.raw.signal,
      );
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ── Page search for AI chat ─────────────────────────────────────────────────

  /**
   * Search pages within a space for AI chat page selection.
   */
  @Post('pages/search')
  async searchPages(
    @Body() dto: AiPageSearchDto,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ) {
    if (!dto.spaceId) {
      return [];
    }

    const pages = await this.pageRepo.findInSpaceByTitle(
      dto.spaceId,
      dto.query || '',
    );

    return pages.map((p) => ({
      pageId: p.id,
      title: p.title,
      slugId: p.slugId,
      spaceId: p.spaceId,
      spaceSlug: p.spaceSlug,
    }));
  }
}
