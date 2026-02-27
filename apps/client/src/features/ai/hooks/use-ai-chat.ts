import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
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
  aiWebSearchEnabledAtom,
  aiMemoriesAtom,
  aiMemoryLoadedAtom,
  aiMemoryErrorAtom,
  Mem0Memory,
} from "../store/ai.atoms";
import { streamAiChat, truncateMessages } from "../services/ai-chat.service";
import { MODEL_CONFIG } from "../lib/models.config";
import { AiMessage, RagSource, AiSession } from "../types/ai-chat.types";
import api from "@/lib/api-client";

export function useAiChat(workspaceId?: string) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useAtom(aiMessagesAtom);
  const [activeSession, setActiveSession] = useAtom(
    aiActiveSessionAtom,
  ) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [, setSources] = useAtom(aiSourcesAtom);
  const [, setIsStreaming] = useAtom(aiIsStreamingAtom);
  const [, setStreamingContent] = useAtom(aiStreamingContentAtom);
  const [, setStreamingThinking] = useAtom(aiStreamingThinkingAtom);
  const selectedModel = useAtomValue(aiSelectedModelAtom);
  const thinking = useAtomValue(aiThinkingAtom);
  const isWebSearchEnabled = useAtomValue(aiWebSearchEnabledAtom);
  const selectedPages = useAtomValue(aiSelectedPagesAtom);
  const [, setMemories] = useAtom(aiMemoriesAtom);
  const [, setMemoryLoaded] = useAtom(aiMemoryLoadedAtom);
  const [, setMemoryError] = useAtom(aiMemoryErrorAtom);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortRef = useRef<AbortController | null>(null);

  const ensureSession = useCallback(async (): Promise<string | undefined> => {
    // If session exists and is already persisted (not a local temp session), use it
    if (activeSession?.id && !activeSession.id.startsWith("local-")) {
      return activeSession.id;
    }
    if (!workspaceId) {
      return undefined;
    }
    // Create a new persisted session
    const response = await api.post<{
      session: AiSession;
      memories: Mem0Memory[];
    }>("/ai/sessions", {});
    const { session: newSession, memories } = response.data;
    setActiveSession(newSession);
    setMemories(memories || []);
    setMemoryLoaded(memories && memories.length > 0);
    // Invalidate sessions cache so history panel shows the new session
    queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
    return newSession.id;
  }, [
    activeSession,
    workspaceId,
    setActiveSession,
    setMemories,
    setMemoryLoaded,
    queryClient,
  ]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Ensure we have a session before sending
      const sessionId = await ensureSession();

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        sources: [],
        createdAt: new Date().toISOString(),
        sessionId: sessionId,
      };
      setMessages((prev) => [...prev, userMessage]);
      setSources([]);
      setStreamingContent("");
      setStreamingThinking("");
      setIsStreaming(true);

      const history = [...messagesRef.current, userMessage]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      let collectedSources: RagSource[] = [];
      let collectedContent = "";
      let collectedThinking = "";

      abortRef.current = streamAiChat(
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
            console.error("AI chat error:", error);
            setIsStreaming(false);
            // Add error message to chat
            const errorMessage: AiMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `Error: ${error}`,
              sources: [],
              createdAt: new Date().toISOString(),
              sessionId: sessionId,
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
          onComplete: async () => {
            // Guard: if user pressed stop, don't add the partial message
            if (abortRef.current?.signal.aborted) return;

            const assistantMessage: AiMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: collectedContent,
              thinking: collectedThinking || undefined,
              sources: collectedSources,
              createdAt: new Date().toISOString(),
              sessionId: sessionId,
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingContent("");
            setStreamingThinking("");
            setIsStreaming(false);

            // Auto-rename: only on the first real message, when title is still the default
            if (activeSession?.title === "New Chat") {
              try {
                const response = await api.post<{ title: string }>(
                  `/ai/sessions/${sessionId}/auto-title`,
                );
                const newTitle = response.data.title;

                // Update local query cache so the sidebar updates instantly
                queryClient.setQueryData<AiSession[]>(
                  ["ai-sessions", workspaceId],
                  (old = []) =>
                    old.map((s) =>
                      s.id === sessionId ? { ...s, title: newTitle } : s,
                    ),
                );

                // Also update active session atom if it matches
                if (activeSession.id === sessionId) {
                  setActiveSession({ ...activeSession, title: newTitle });
                }
              } catch (e) {
                console.warn("Failed to auto-update title:", e);
              }
            }
          },
          onMemory: (memory) => {
            if (memory.enabled) {
              setMemoryLoaded(memory.loaded);
            }
          },
        },
        {
          sessionId: sessionId,
          model:
            thinking && MODEL_CONFIG[selectedModel]?.thinkingModel
              ? MODEL_CONFIG[selectedModel].thinkingModel!
              : selectedModel,
          thinking,
          isWebSearchEnabled,
          selectedPageIds: selectedPages.map((p) => p.pageId),
        },
      );
    },
    [
      setMessages,
      setSources,
      setIsStreaming,
      setStreamingContent,
      setMemoryLoaded,
      setMemories,
      ensureSession,
      selectedModel,
      thinking,
      selectedPages,
    ],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingThinking("");
  }, [setIsStreaming, setStreamingContent, setStreamingThinking]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSources([]);
    setStreamingContent("");
  }, [setMessages, setSources, setStreamingContent]);

  const setSession = useCallback(
    (session: AiSession | null) => {
      setActiveSession(session);
      if (!session) {
        setMessages([]);
      }
    },
    [setActiveSession, setMessages],
  );

  const editAndResendMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeSession?.id || activeSession.id.startsWith("local-")) return;

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      // 1. Keep messages BEFORE the edit
      const keptMessages = messages.slice(0, msgIndex);

      // 2. Create edited message
      const editedMessage = { ...messages[msgIndex], content: newContent };

      // 3. Clear streams and update UI immediately
      setStreamingContent("");
      setStreamingThinking("");
      setMessages([...keptMessages, editedMessage]);
      setIsStreaming(true);

      try {
        // 4. Truncate backend (single atomic call)
        await truncateMessages(activeSession.id, messageId);

        // 5. Build history for AI
        const history = [...keptMessages, editedMessage]
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        // 6. Re-send to AI
        let collectedSources: RagSource[] = [];
        let collectedContent = "";
        let collectedThinking = "";

        abortRef.current = streamAiChat(
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
              console.error("AI chat error:", error);
              setIsStreaming(false);
              const errorMessage: AiMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `Error: ${error}`,
                sources: [],
                createdAt: new Date().toISOString(),
                sessionId: activeSession.id,
              };
              setMessages((prev) => [...prev, errorMessage]);
            },
            onComplete: () => {
              if (abortRef.current?.signal.aborted) return;
              const assistantMessage: AiMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: collectedContent,
                thinking: collectedThinking || undefined,
                sources: collectedSources,
                createdAt: new Date().toISOString(),
                sessionId: activeSession.id,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent("");
              setStreamingThinking("");
              setIsStreaming(false);
            },
            onMemory: (memory) => {
              if (memory.enabled) {
                setMemoryLoaded(memory.loaded);
              }
            },
          },
          {
            sessionId: activeSession.id,
            model:
              thinking && MODEL_CONFIG[selectedModel]?.thinkingModel
                ? MODEL_CONFIG[selectedModel].thinkingModel!
                : selectedModel,
            thinking,
            isWebSearchEnabled,
            selectedPageIds: selectedPages.map((p) => p.pageId),
          },
        );
      } catch (error) {
        console.error("Failed to edit message:", error);
        setIsStreaming(false);
      }
    },
    [
      activeSession,
      messages,
      setMessages,
      setSources,
      setIsStreaming,
      setStreamingContent,
      setStreamingThinking,
      setMemoryLoaded,
      selectedModel,
      thinking,
      isWebSearchEnabled,
      selectedPages,
    ],
  );

  return {
    sendMessage,
    stopStream,
    clearMessages,
    setSession,
    activeSession,
    editAndResendMessage,
  };
}
