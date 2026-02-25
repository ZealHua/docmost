import { useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  aiMessagesAtom,
  aiActiveSessionAtom,
  aiDesignModeAtom,
  aiDesignClarifyingAtom,
  aiThreadIdAtom,
  aiIsStreamingAtom,
  aiStreamingContentAtom,
} from '../store/ai.atoms';
import { AiSession } from '../types/ai-chat.types';
import { useLangGraphStream, ensureThreadId } from './use-langgraph-stream';
import { clarifyObjective } from '../services/ai-design.service';
import { AiMessage } from '../types/ai-chat.types';
import api from '@/lib/api-client';

export function useDesignChat() {
  const [, setMessages] = useAtom(aiMessagesAtom);
  const [activeSession, setActiveSession] = useAtom(aiActiveSessionAtom) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [designMode, setDesignMode] = useAtom(aiDesignModeAtom);
  const [designClarifying, setDesignClarifying] = useAtom(aiDesignClarifyingAtom);
  const [threadId, setThreadId] = useAtom(aiThreadIdAtom) as readonly [string | null, (val: string | null) => void];

  const [, setIsStreamingAtom] = useAtom(aiIsStreamingAtom);
  const [, setStreamingContent] = useAtom(aiStreamingContentAtom);

  // Accumulate streamed content in a ref to avoid stale closures
  const collectedContentRef = useRef('');

  const { submit, stop, isStreaming } = useLangGraphStream({
    threadId,
    onMessage: (msg) => {
      console.log('[Design] onMessage, content length:', msg.content.length);
      collectedContentRef.current = msg.content;
      setStreamingContent(msg.content);
    },
    onClarification: (content) => {
      console.log('[Design] Clarification received:', content);
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
      // Keep designMode active so user can reply
    },
    onFinish: (state) => {
      const content = collectedContentRef.current;
      console.log('[Design] onFinish, collected content length:', content?.length || 0);

      if (content) {
        const assistantMessage: AiMessage = {
          id: `design-${Date.now()}`,
          role: 'assistant',
          content,
          sources: [],
          createdAt: new Date().toISOString(),
          sessionId: activeSession?.id,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // If artifacts were produced, design flow is complete
      if (state?.artifacts && state.artifacts.length > 0) {
        console.log('[Design] Artifacts produced, exiting design mode');
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
      console.log('[Design] sendDesignMessage:', content);
      console.log('[Design] Guards: isStreaming=', isStreaming, 'threadId=', threadId, 'designMode=', designMode);

      if (!content.trim() || isStreaming) {
        console.log('[Design] Blocked by guard — empty:', !content.trim(), 'streaming:', isStreaming);
        return;
      }

      // Ensure session
      let sessionId = activeSession?.id;
      if (!sessionId) {
        try {
          const response = await api.post<{ session: AiSession }>('/ai/sessions', {});
          sessionId = response.data.session.id;
          setActiveSession(response.data.session);
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

      let currentThreadId = threadId;

      // First message: clarify + create thread
      if (!currentThreadId) {
        try {
          setDesignClarifying('Clarifying objective...');
          const { objective } = await clarifyObjective(content);
          setDesignClarifying(`Objective: ${objective}`);
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          setDesignClarifying('');
        }

        try {
          currentThreadId = await ensureThreadId();
          setThreadId(currentThreadId);
          console.log('[Design] Thread created:', currentThreadId);
        } catch (error) {
          console.error('[Design] Failed to create thread:', error);
          setIsStreamingAtom(false);
          return;
        }
      } else {
        console.log('[Design] Follow-up, reusing thread:', currentThreadId);
      }

      setDesignClarifying('');
      await submit({ messages: [{ type: 'human', content }] }, currentThreadId);
    },
    [activeSession?.id, threadId, isStreaming, setMessages, setActiveSession, setDesignClarifying, setThreadId, setIsStreamingAtom, setStreamingContent, submit],
  );

  return {
    sendDesignMessage,
    stop,
    isStreaming,
    designMode,
    designClarifying,
  };
}
