import { useState, useCallback, useRef } from 'react';
import { RagSource } from '../types/ai-chat.types';

export interface FaqMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
}

export function useFaqChat(workspaceId?: string) {
  const [messages, setMessages] = useState<FaqMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !workspaceId) return;

      const userMessage: FaqMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      const assistantMessageId = crypto.randomUUID();
      let collectedContent = '';
      let collectedSources: RagSource[] = [];

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
        },
      ]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch('/api/ai/faq/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: content }),
          signal: abortRef.current.signal,
        });

        if (!response.body) {
          throw new Error('ReadableStream not yet supported in this browser.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const events = chunk.split('\n\n');

          for (const event of events) {
            if (!event.startsWith('data: ')) continue;
            const dataStr = event.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'sources') {
                collectedSources = parsed.data;
              } else if (parsed.type === 'chunk') {
                collectedContent += parsed.data;
              } else if (parsed.type === 'error') {
                throw new Error(parsed.data);
              }

              // Update the assistant message in real-time
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: collectedContent, sources: collectedSources }
                    : msg
                )
              );
            } catch (e) {
              // Only log JSON parse errors, as stream chunks might be split
              console.debug('Failed to parse SSE chunk', e);
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('FAQ stream error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${error.message}` }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [workspaceId]
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    stopStream();
  }, [stopStream]);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStream,
    clearMessages,
  };
}
