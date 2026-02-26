import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import {
  aiMessagesAtom,
  aiActiveSessionAtom,
  aiDesignModeAtom,
  aiThreadIdAtom,
  aiIsStreamingAtom,
  aiStreamingContentAtom,
  aiTodosAtom,
  aiSubtaskProgressAtom,
} from '../store/ai.atoms';
import { AiSession, AiMessage, SubtaskEvent } from '../types/ai-chat.types';
import { useLangGraphStream, ensureThreadId } from './use-langgraph-stream';
import api from '@/lib/api-client';

export function useDesignChat() {
  const queryClient = useQueryClient();
  const [, setMessages] = useAtom(aiMessagesAtom);
  const [activeSession, setActiveSession] = useAtom(aiActiveSessionAtom) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [designMode, setDesignMode] = useAtom(aiDesignModeAtom);
  const [threadId, setThreadId] = useAtom(aiThreadIdAtom) as readonly [string | null, (val: string | null) => void];

  const [, setIsStreamingAtom] = useAtom(aiIsStreamingAtom);
  const [, setStreamingContent] = useAtom(aiStreamingContentAtom);
  const [, setTodos] = useAtom(aiTodosAtom);
  const [, setSubtaskProgress] = useAtom(aiSubtaskProgressAtom);

  // Accumulate streamed content in a ref to avoid stale closures
  const collectedContentRef = useRef('');
  const lastUserMessageRef = useRef('');
  const sessionIdRef = useRef<string | undefined>(undefined);
  // Track whether the agent is waiting for a clarification answer
  const waitingForClarificationRef = useRef(false);

  // Track whether the stream was aborted by the user
  const abortedRef = useRef(false);

  const { submit, stop: rawStop, isStreaming } = useLangGraphStream({
    threadId,
    onMessage: (msg) => {
      collectedContentRef.current = msg.content;
      setStreamingContent(msg.content);
    },
    onClarification: (content) => {
      waitingForClarificationRef.current = true;
      const clarificationMsg: AiMessage = {
        id: `clarification-${Date.now()}`,
        role: 'assistant',
        content,
        sources: [],
        createdAt: new Date().toISOString(),
        sessionId: activeSession?.id,
      };
      setMessages((prev) => [...prev, clarificationMsg]);
      setStreamingContent('');
      setIsStreamingAtom(false);
      // designMode stays active so user can reply
    },
    onTaskProgress: (event: SubtaskEvent) => {
      setSubtaskProgress((prev) => {
        // Update existing task or add new one
        const idx = prev.findIndex((e) => e.task_id === event.task_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = event;
          return updated;
        }
        return [...prev, event];
      });
    },
    onFinish: (state) => {
      // Guard: if user pressed stop, don't add partial content
      if (abortedRef.current) {
        abortedRef.current = false;
        collectedContentRef.current = '';
        return;
      }
      const content = collectedContentRef.current;

      if (content) {
        const assistantMessage: AiMessage = {
          id: state?.lastMessageId || `design-${Date.now()}`,
          role: 'assistant',
          content,
          sources: [],
          createdAt: new Date().toISOString(),
          sessionId: activeSession?.id,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Persist messages to backend
        const sid = sessionIdRef.current;
        if (sid && !sid.startsWith('local-')) {
          const userContent = lastUserMessageRef.current;
          if (userContent) {
            api.post(`/ai/sessions/${sid}/messages`, {
              role: 'user', content: userContent, sources: [],
            }).catch(() => {});
          }
          api.post(`/ai/sessions/${sid}/messages`, {
            role: 'assistant', content, sources: [],
          }).catch(() => {});
        }
      }

      // Sync title from LangGraph thread state to session
      if (state?.title) {
        const sid = sessionIdRef.current;
        if (sid && !sid.startsWith('local-')) {
          api.patch(`/ai/sessions/${sid}`, { title: state.title })
            .then(() => {
              // Update local query cache so the sidebar updates
              queryClient.setQueryData<AiSession[]>(['ai-sessions'], (old = []) =>
                old.map((s) => (s.id === sid ? { ...s, title: state.title! } : s)),
              );
              if (activeSession?.id === sid) {
                setActiveSession({ ...activeSession, title: state.title! });
              }
            })
            .catch((err) => console.warn('[Design] Failed to sync title:', err));
        }
      }

      // Update todos from thread state
      if (state?.todos && state.todos.length > 0) {
        setTodos(state.todos);
      }

      // Clear subtask progress when stream finishes
      setSubtaskProgress([]);

      // If artifacts were produced, design flow is complete
      if (state?.artifacts && state.artifacts.length > 0) {
        setDesignMode(false);
      }

      collectedContentRef.current = '';
      setStreamingContent('');
      setIsStreamingAtom(false);
    },
    onError: (error) => {
      console.error('[Design] Error:', error);
      collectedContentRef.current = '';
      setStreamingContent('');
      setIsStreamingAtom(false);
      setSubtaskProgress([]);
      waitingForClarificationRef.current = false;
      const errorMsg: AiMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        sources: [],
        createdAt: new Date().toISOString(),
        sessionId: activeSession?.id,
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const sendDesignMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      // Ensure session is persisted (not local-only)
      let sessionId = activeSession?.id;
      if (!sessionId || sessionId.startsWith('local-')) {
        try {
          const response = await api.post<{ session: AiSession }>('/ai/sessions', {});
          sessionId = response.data.session.id;
          setActiveSession(response.data.session);
          queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
        } catch (error) {
          console.error('[Design] Failed to create session:', error);
          return;
        }
      }

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          sources: [],
          createdAt: new Date().toISOString(),
          sessionId,
        },
      ]);
      collectedContentRef.current = '';
      setStreamingContent('');
      setIsStreamingAtom(true);
      setSubtaskProgress([]); // Clear previous subtask progress
      lastUserMessageRef.current = content;
      sessionIdRef.current = sessionId;
      abortedRef.current = false;

      let currentThreadId = threadId;

      // First message: create thread
      if (!currentThreadId) {
        try {
          currentThreadId = await ensureThreadId();
          setThreadId(currentThreadId);

          // Persist thread ID with the session
          if (sessionId && !sessionId.startsWith('local-')) {
            try {
              await api.patch(`/ai/sessions/${sessionId}/thread`, { threadId: currentThreadId });
            } catch (err) {
              console.warn('[Design] Failed to persist thread ID:', err);
            }
          }
        } catch (error) {
          console.error('[Design] Failed to create thread:', error);
          setIsStreamingAtom(false);
          return;
        }
      }

      // If we're answering a clarification, use command.resume to continue the interrupted run
      if (waitingForClarificationRef.current) {
        waitingForClarificationRef.current = false;
        await submit(null, currentThreadId, { resume: { answer: content } });
      } else {
        await submit({ messages: [{ type: 'human', content }] }, currentThreadId);
      }
    },
    [activeSession?.id, threadId, isStreaming, setMessages, setActiveSession, setThreadId, setIsStreamingAtom, setStreamingContent, setSubtaskProgress, submit, queryClient],
  );

  const stop = useCallback(() => {
    abortedRef.current = true;
    rawStop();
    collectedContentRef.current = '';
    setStreamingContent('');
    setIsStreamingAtom(false);
    setSubtaskProgress([]);
  }, [rawStop, setStreamingContent, setIsStreamingAtom, setSubtaskProgress]);

  return {
    sendDesignMessage,
    stop,
    isStreaming,
    designMode,
  };
}
