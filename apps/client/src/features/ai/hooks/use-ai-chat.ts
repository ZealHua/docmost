import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import {
  aiMessagesAtom,
  aiSourcesAtom,
  aiIsStreamingAtom,
  aiStreamingContentAtom,
  aiStreamingThinkingAtom,
  aiActiveSessionAtom,
  aiSelectedModelAtom,
  aiThinkingAtom,
  aiSelectedPagesAtom,
} from '../store/ai.atoms';
import { streamAiChat } from '../services/ai-chat.service';
import { MODEL_CONFIG } from '../lib/models.config';
import { AiMessage, RagSource, AiSession } from '../types/ai-chat.types';
import api from '@/lib/api-client';

export function useAiChat(workspaceId?: string) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useAtom(aiMessagesAtom);
  const [activeSession, setActiveSession] = useAtom(aiActiveSessionAtom) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [, setSources] = useAtom(aiSourcesAtom);
  const [, setIsStreaming] = useAtom(aiIsStreamingAtom);
  const [, setStreamingContent] = useAtom(aiStreamingContentAtom);
  const [, setStreamingThinking] = useAtom(aiStreamingThinkingAtom);
  const selectedModel = useAtomValue(aiSelectedModelAtom);
  const thinking = useAtomValue(aiThinkingAtom);
  const selectedPages = useAtomValue(aiSelectedPagesAtom);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortRef = useRef<AbortController | null>(null);

  const ensureSession = useCallback(async (): Promise<string | undefined> => {
    if (activeSession?.id) {
      return activeSession.id;
    }
    if (!workspaceId) {
      return undefined;
    }
    // Create a new session
    const response = await api.post<AiSession>('/ai/sessions', {});
    const newSession = response.data;
    setActiveSession(newSession);
    return newSession.id;
  }, [activeSession, workspaceId, setActiveSession]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Ensure we have a session before sending
      const sessionId = await ensureSession();

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        sources: [],
        createdAt: new Date().toISOString(),
        sessionId: sessionId,
      };
      setMessages((prev) => [...prev, userMessage]);
      setSources([]);
      setStreamingContent('');
      setStreamingThinking('');
      setIsStreaming(true);

      const history = [...messagesRef.current, userMessage]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      let collectedSources: RagSource[] = [];
      let collectedContent = '';
      let collectedThinking = '';

      abortRef.current = await streamAiChat(
        history,
        {
          onSources: (sources) => {
            collectedSources = sources;
            setSources(sources);
          },
          onChunk: (chunk) => {
            collectedContent += chunk;
            setStreamingContent((prev) => prev + chunk);
          },
          onThinking: (thinking) => {
            collectedThinking += thinking;
            setStreamingThinking((prev) => prev + thinking);
          },
          onError: (error) => {
            console.error('AI chat error:', error);
            setIsStreaming(false);
            // Add error message to chat
            const errorMessage: AiMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Error: ${error}`,
              sources: [],
              createdAt: new Date().toISOString(),
              sessionId: sessionId,
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
          onComplete: async () => {
            const assistantMessage: AiMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: collectedContent,
              thinking: collectedThinking || undefined,
              sources: collectedSources,
              createdAt: new Date().toISOString(),
              sessionId: sessionId,
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingContent('');
            setStreamingThinking('');
            setIsStreaming(false);

            // Auto-rename: only on the first real message, when title is still the default
            if (activeSession?.title === 'New Chat') {
              try {
                const response = await api.post<{ title: string }>(`/ai/sessions/${sessionId}/auto-title`);
                const newTitle = response.data.title;

                // Update local query cache so the sidebar updates instantly
                queryClient.setQueryData<AiSession[]>(['ai-sessions', workspaceId], (old = []) =>
                  old.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)),
                );

                // Also update active session atom if it matches
                if (activeSession.id === sessionId) {
                  setActiveSession({ ...activeSession, title: newTitle });
                }
              } catch (e) {
                console.warn('Failed to auto-update title:', e);
              }
            }
          },
        },
        { 
          sessionId: sessionId, 
          model: thinking && MODEL_CONFIG[selectedModel]?.thinkingModel
            ? MODEL_CONFIG[selectedModel].thinkingModel!
            : selectedModel,
          thinking, 
          ...(selectedPages.length > 0 && { selectedPageIds: selectedPages.map(p => p.pageId) })
        },
      );
    },
    [setMessages, setSources, setIsStreaming, setStreamingContent, ensureSession, selectedModel, thinking, selectedPages],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [setIsStreaming]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSources([]);
    setStreamingContent('');
  }, [setMessages, setSources, setStreamingContent]);

  const setSession = useCallback((session: AiSession | null) => {
    setActiveSession(session);
    if (!session) {
      setMessages([]);
    }
  }, [setActiveSession, setMessages]);

  return { sendMessage, stopStream, clearMessages, setSession, activeSession };
}
