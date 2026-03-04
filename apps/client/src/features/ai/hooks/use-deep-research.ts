import { useCallback, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { deepResearchMachine, DeepResearchEvent, ResearchMessage } from '../state/deep-research.machine';
import {
  aiActiveSessionAtom,
  aiIsStreamingAtom,
  aiMessagesAtom,
  aiSourcesAtom,
  aiStreamingContentAtom,
  aiStreamingThinkingAtom,
} from '../store/ai.atoms';
import { AiMessage, RagSource, AiSession } from '../types/ai-chat.types';
import api from '@/lib/api-client';

export interface UseDeepResearchReturn {
  state: any;
  send: (event: DeepResearchEvent) => void;
  startResearch: (query: string, options?: {
    model?: string;
    isWebSearchEnabled?: boolean;
    selectedPageIds?: string[];
  }) => void;
  provideClarification: (answer: string) => void;
  approvePlan: () => void;
  rejectPlan: () => void;
  modifyPlan: (plan: any) => void;
  cancelResearch: () => void;
  resetResearch: () => void;
}

export function useDeepResearch(workspaceId?: string, userId?: string): UseDeepResearchReturn {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ResearchMessage[]>([]);
  const clarificationRoundRef = useRef(0);
  const requestOptionsRef = useRef<{
    model?: string;
    isWebSearchEnabled?: boolean;
    selectedPageIds?: string[];
  }>({});

  const collectedThinkingRef = useRef('');
  const collectedContentRef = useRef('');
  const collectedSourcesRef = useRef<RagSource[]>([]);
  const finalizedRef = useRef(false);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const [state, send] = useMachine(deepResearchMachine);
  const [, setChatMessages] = useAtom(aiMessagesAtom);
  const [, setActiveSession] = useAtom(aiActiveSessionAtom) as readonly [
    AiSession | null,
    (val: AiSession | null) => void,
  ];
  const [, setIsStreaming] = useAtom(aiIsStreamingAtom);
  const [, setStreamingThinking] = useAtom(aiStreamingThinkingAtom);
  const [, setStreamingContent] = useAtom(aiStreamingContentAtom);
  const [, setSources] = useAtom(aiSourcesAtom);
  const activeSession = useAtomValue(aiActiveSessionAtom);

  const ensureSession = useCallback(async (): Promise<string | undefined> => {
    if (activeSession?.id && !activeSession.id.startsWith('local-')) {
      return activeSession.id;
    }

    if (!workspaceId) {
      return undefined;
    }

    const response = await api.post<{ session: AiSession }>('/ai/sessions', {});
    const newSession = response.data.session;
    setActiveSession(newSession);
    queryClient.invalidateQueries({ queryKey: ['ai-sessions', workspaceId] });
    return newSession.id;
  }, [activeSession?.id, queryClient, setActiveSession, workspaceId]);

  const persistMessage = useCallback(async (
    sessionId: string | undefined,
    payload: { role: 'user' | 'assistant'; content: string; sources?: any[] }
  ) => {
    if (!sessionId) {
      return;
    }

    try {
      await api.post(`/ai/sessions/${sessionId}/messages`, payload);
    } catch (error) {
      console.warn('Failed to persist deep research message:', error);
    }
  }, []);

  const appendThinkingLine = useCallback((line: string) => {
    if (!line.trim()) {
      return;
    }

    const next = collectedThinkingRef.current
      ? `${collectedThinkingRef.current}\n${line}`
      : line;

    collectedThinkingRef.current = next;
    setStreamingThinking(next);
  }, [setStreamingThinking]);

  const mapDeepResearchSources = useCallback((rawSources: any[]): RagSource[] => {
    return rawSources.map((source, index) => ({
      pageId: source.url || `${source.title || 'source'}-${index}`,
      title: source.title || `Source ${index + 1}`,
      slugId: '',
      spaceSlug: '',
      excerpt: source.excerpt || '',
      similarity: 1,
      chunkIndex: index,
      url: source.url,
    }));
  }, []);

  const mergeSources = useCallback((existing: RagSource[], incoming: RagSource[]) => {
    const map = new Map<string, RagSource>();

    for (const source of existing) {
      const key = `${source.url || ''}|${source.title}`;
      map.set(key, source);
    }

    for (const source of incoming) {
      const key = `${source.url || ''}|${source.title}`;
      map.set(key, source);
    }

    return Array.from(map.values());
  }, []);

  const resetStreamingAtoms = useCallback(() => {
    setIsStreaming(false);
    setStreamingThinking('');
    setStreamingContent('');
    setSources([]);
    collectedThinkingRef.current = '';
    collectedContentRef.current = '';
    collectedSourcesRef.current = [];
    finalizedRef.current = false;
  }, [setIsStreaming, setSources, setStreamingContent, setStreamingThinking]);

  const finalizeAssistantMessage = useCallback((fallbackContent?: string) => {
    if (finalizedRef.current) {
      return;
    }

    finalizedRef.current = true;
    const content = collectedContentRef.current.trim() || fallbackContent || 'Deep research completed, but no final report content was generated.';

    const assistantMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      thinking: collectedThinkingRef.current || undefined,
      sources: collectedSourcesRef.current,
      createdAt: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    };

    setChatMessages((prev) => [...prev, assistantMessage]);
    void persistMessage(sessionIdRef.current, {
      role: 'assistant',
      content,
      sources: collectedSourcesRef.current,
    });
    setIsStreaming(false);
    setStreamingThinking('');
    setStreamingContent('');
    setSources([]);
  }, [persistMessage, setChatMessages, setIsStreaming, setSources, setStreamingContent, setStreamingThinking]);

  const applyUiFromEvent = useCallback((parsed: any) => {
    switch (parsed?.type) {
      case 'quota_check': {
        if (parsed.data?.allowed) {
          appendThinkingLine(`Quota check passed: ${parsed.data.reason || 'within limits'}`);
        } else {
          appendThinkingLine(`Quota exceeded: ${parsed.data?.reason || 'research cannot continue'}`);
        }
        break;
      }
      case 'clarification_needed': {
        appendThinkingLine(`Clarification needed: ${parsed.data?.question || 'Please provide more details.'}`);
        break;
      }
      case 'clarification_complete': {
        appendThinkingLine('Clarification accepted. Proceeding to execution.');
        break;
      }
      case 'plan_generated': {
        const stepCount = Array.isArray(parsed.data?.steps) ? parsed.data.steps.length : 0;
        appendThinkingLine(`Plan generated with ${stepCount} steps. Waiting for your approval.`);
        break;
      }
      case 'plan_validated': {
        appendThinkingLine('Plan validated.');
        break;
      }
      case 'step_started': {
        appendThinkingLine(`▶ ${parsed.data?.title || parsed.data?.stepId || 'Starting step'}`);
        break;
      }
      case 'step_progress': {
        const progress = typeof parsed.data?.progress === 'number' ? `${parsed.data.progress}%` : 'in progress';
        appendThinkingLine(`… ${parsed.data?.stepId || 'Step'} ${progress}`);
        break;
      }
      case 'step_completed': {
        appendThinkingLine(`✓ Completed ${parsed.data?.stepId || 'step'}`);
        break;
      }
      case 'sources': {
        const incoming = mapDeepResearchSources(Array.isArray(parsed.data) ? parsed.data : []);
        collectedSourcesRef.current = mergeSources(collectedSourcesRef.current, incoming);
        setSources(collectedSourcesRef.current);
        if (incoming.length > 0) {
          appendThinkingLine(`Collected ${incoming.length} source${incoming.length > 1 ? 's' : ''}.`);
        }
        break;
      }
      case 'chunk': {
        const chunkText = typeof parsed.data === 'string' ? parsed.data : '';
        if (!chunkText) {
          break;
        }
        collectedContentRef.current += chunkText;
        setStreamingContent((prev) => prev + chunkText);
        break;
      }
      case 'error': {
        if (parsed.data?.recoverable) {
          appendThinkingLine(`⚠ ${parsed.data?.error || 'A recoverable step failed.'}`);
        } else if (parsed.data?.error && parsed.data?.error !== 'CLARIFICATION_NEEDED') {
          appendThinkingLine(`Error: ${parsed.data.error}`);
          finalizeAssistantMessage(`Deep research failed: ${parsed.data.error}`);
        }
        break;
      }
      case 'complete': {
        const report = parsed.data?.report;
        finalizeAssistantMessage(typeof report === 'string' ? report : undefined);
        break;
      }
      default:
        break;
    }
  }, [appendThinkingLine, finalizeAssistantMessage, mapDeepResearchSources, mergeSources, setSources, setStreamingContent]);

  const appendUserMessage = useCallback((content: string) => {
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      sources: [],
      createdAt: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    };
    setChatMessages((prev) => [...prev, userMessage]);
    void persistMessage(sessionIdRef.current, {
      role: 'user',
      content,
      sources: [],
    });
  }, [persistMessage, setChatMessages]);

  const startStreamingBubble = useCallback((seed: string) => {
    finalizedRef.current = false;
    collectedThinkingRef.current = seed;
    collectedContentRef.current = '';
    collectedSourcesRef.current = [];
    setSources([]);
    setStreamingContent('');
    setStreamingThinking(seed);
    setIsStreaming(true);
  }, [setIsStreaming, setSources, setStreamingContent, setStreamingThinking]);

  const dispatchSseEvent = useCallback((parsed: any) => {
    send({ type: 'SSE_EVENT', event: parsed });
    applyUiFromEvent(parsed);
  }, [applyUiFromEvent, send]);

  const streamDeepResearch = useCallback(async (
    payload: {
      messages: ResearchMessage[];
      model: string;
      isWebSearchEnabled: boolean;
      selectedPageIds: string[];
      clarificationRound?: number;
    },
    abortController: AbortController
  ) => {
    const response = await fetch('/api/ai/deep-research/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const combined = lineBuffer + chunk;
      const lines = combined.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }

        const data = line.slice(6).trim();
        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          dispatchSseEvent(parsed);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  }, [dispatchSseEvent]);

  const runResearchStream = useCallback(async (
    payload: {
      messages: ResearchMessage[];
      model: string;
      isWebSearchEnabled: boolean;
      selectedPageIds: string[];
      clarificationRound?: number;
    }
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await streamDeepResearch(payload, abortController);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Deep research error:', error);
        send({
          type: 'SSE_EVENT',
          event: {
            type: 'error',
            data: { error: error.message, recoverable: false },
          },
        });
        appendThinkingLine(`Error: ${error.message}`);
        finalizeAssistantMessage(`Deep research failed: ${error.message}`);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [appendThinkingLine, finalizeAssistantMessage, send, streamDeepResearch]);

  const startResearch = useCallback(async (
    query: string,
    options: {
      model?: string;
      isWebSearchEnabled?: boolean;
      selectedPageIds?: string[];
    } = {}
  ) => {
    const sessionId = await ensureSession();
    sessionIdRef.current = sessionId;

    const normalizedWorkspaceId = workspaceId || '';
    const normalizedUserId = userId || '';

    messagesRef.current = [{ role: 'user', content: query }];
    clarificationRoundRef.current = 0;
    requestOptionsRef.current = {
      model: options.model,
      isWebSearchEnabled: options.isWebSearchEnabled ?? false,
      selectedPageIds: options.selectedPageIds || [],
    };
    appendUserMessage(query);
    startStreamingBubble('Starting deep research…');

    send({
      type: 'START_RESEARCH',
      query,
      workspaceId: normalizedWorkspaceId,
      userId: normalizedUserId,
      model: options.model,
      isWebSearchEnabled: options.isWebSearchEnabled ?? false,
      selectedPageIds: options.selectedPageIds,
    });

    await runResearchStream({
      messages: messagesRef.current,
      model: options.model || '',
      isWebSearchEnabled: options.isWebSearchEnabled ?? false,
      selectedPageIds: options.selectedPageIds || [],
    });
  }, [appendUserMessage, ensureSession, runResearchStream, send, startStreamingBubble, userId, workspaceId]);

  const provideClarification = useCallback(async (answer: string) => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = await ensureSession();
    }

    send({ type: 'PROVIDE_CLARIFICATION', answer });
    appendThinkingLine(`Clarification provided: ${answer}`);
    appendThinkingLine('Continuing research…');

    messagesRef.current = [...messagesRef.current, { role: 'user', content: answer }];
    clarificationRoundRef.current = clarificationRoundRef.current + 1;

    await runResearchStream({
      messages: messagesRef.current,
      model: requestOptionsRef.current.model || '',
      isWebSearchEnabled: requestOptionsRef.current.isWebSearchEnabled ?? false,
      selectedPageIds: requestOptionsRef.current.selectedPageIds || [],
      clarificationRound: clarificationRoundRef.current,
    });
  }, [appendThinkingLine, appendUserMessage, ensureSession, runResearchStream, send]);

  const approvePlan = useCallback(() => {
    send({ type: 'APPROVE_PLAN' });
  }, [send]);

  const rejectPlan = useCallback(() => {
    send({ type: 'REJECT_PLAN' });
  }, [send]);

  const modifyPlan = useCallback((plan: any) => {
    send({ type: 'MODIFY_PLAN', plan });
  }, [send]);

  const cancelResearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    resetStreamingAtoms();
    send({ type: 'CANCEL' });
  }, [resetStreamingAtoms, send]);

  const resetResearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    messagesRef.current = [];
    clarificationRoundRef.current = 0;
    sessionIdRef.current = undefined;
    resetStreamingAtoms();
    send({ type: 'RESET' });
  }, [resetStreamingAtoms, send]);

  return {
    state,
    send,
    startResearch,
    provideClarification,
    approvePlan,
    rejectPlan,
    modifyPlan,
    cancelResearch,
    resetResearch,
  };
}
