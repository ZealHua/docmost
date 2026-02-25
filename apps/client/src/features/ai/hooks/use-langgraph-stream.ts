import { useCallback, useRef, useState } from 'react';
import { getLangGraphClient } from '@/lib/langgraph-client';
import { useArtifacts } from '../context/artifacts-context';
import { LANGGRAPH_BASE_URL } from '@/lib/langgraph-client';

export interface LangGraphMessage {
  type: string;
  content: string;
}

export interface LangGraphState {
  artifacts?: string[];
  messages?: LangGraphMessage[];
  title?: string;
}

export interface UseLangGraphStreamOptions {
  threadId: string | null;
  onMessage?: (message: LangGraphMessage) => void;
  onClarification?: (content: string) => void;
  onFinish?: (state: LangGraphState) => void;
  onError?: (error: Error) => void;
}

export function useLangGraphStream({
  threadId: initialThreadId,
  onMessage,
  onClarification,
  onFinish,
  onError,
}: UseLangGraphStreamOptions) {
  const { setArtifacts, setOpen, setAutoOpen } = useArtifacts();
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Refs for callbacks to avoid stale closures
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onClarificationRef = useRef(onClarification);
  onClarificationRef.current = onClarification;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const submit = useCallback(
    async (input: { messages: Array<{ type: string; content: string }> }, threadId?: string) => {
      const actualThreadId = threadId || initialThreadId;

      if (!actualThreadId) {
        onErrorRef.current?.(new Error('No thread ID provided'));
        return;
      }

      setIsStreaming(true);

      // Environment config
      const assistantId = process.env.LANGGRAPH_ASSISTANT_ID || 'lead_agent';
      const modelName = process.env.LANGGRAPH_MODEL_NAME || 'deepseek-reasoner';
      const thinkingEnabled = process.env.LANGGRAPH_THINKING_ENABLED === 'true';

      console.log('[LangGraph] Submitting to', LANGGRAPH_BASE_URL, 'thread:', actualThreadId);

      try {
        const payload = {
          assistant_id: assistantId,
          input: {
            messages: input.messages.map((msg) => ({
              role: msg.type === 'human' ? 'user' : 'assistant',
              content: msg.content,
            })),
          },
          stream_mode: ['values', 'messages'],
          config: {
            recursion_limit: 1000,
            configurable: {
              model_name: modelName,
              thinking_enabled: thinkingEnabled,
              is_plan_mode: true,
              thread_id: actualThreadId,
            },
          },
        };

        console.log('[LangGraph] Payload:', JSON.stringify(payload, null, 2));

        abortRef.current = new AbortController();

        const response = await fetch(
          `${LANGGRAPH_BASE_URL}/threads/${actualThreadId}/runs/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortRef.current.signal,
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is null');
        }

        let currentEventType = '';
        let buffer = '';
        let finalArtifacts: string[] = [];
        let clarificationSent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Log raw lines for debugging
            if (trimmedLine) {
              console.log('[LangGraph SSE] Raw:', trimmedLine.slice(0, 200));
            }

            if (!trimmedLine) continue;

            // Handle event type line
            if (trimmedLine.startsWith('event:')) {
              currentEventType = trimmedLine.slice(6).trim();
              console.log('[LangGraph SSE] Event type:', currentEventType);
              continue;
            }

            // Handle data line
            if (!trimmedLine.startsWith('data:')) continue;

            const data = trimmedLine.slice(5).trim();

            if (data === '[DONE]') {
              console.log('[LangGraph SSE] [DONE]');
              currentEventType = '';
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // LangGraph sends [eventType, payload] tuples when multiple stream_modes are combined
              let effectiveEventType = currentEventType;
              let eventData = parsed;
              if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'string') {
                effectiveEventType = parsed[0];
                eventData = parsed[1];
                console.log('[LangGraph SSE] Tuple format, type:', effectiveEventType);
              }

              // Handle values event (full state snapshot)
              if (effectiveEventType === 'values') {
                console.log('[LangGraph SSE] Values event, keys:', Object.keys(eventData || {}));

                // Extract artifacts
                const artifacts = eventData?.artifacts;
                if (artifacts && Array.isArray(artifacts) && artifacts.length > 0) {
                  console.log('[LangGraph SSE] Artifacts found:', artifacts);
                  finalArtifacts = artifacts;
                  setArtifacts(artifacts);
                  setAutoOpen(true);
                  setOpen(true);
                }

                // Scan for clarification ToolMessages
                if (eventData.messages && Array.isArray(eventData.messages)) {
                  for (const msg of eventData.messages) {
                    if (msg.type === 'tool' && msg.name === 'ask_clarification') {
                      const content = typeof msg.content === 'string' ? msg.content : '';
                      if (content && !clarificationSent) {
                        console.log('[LangGraph SSE] Clarification detected:', content);
                        clarificationSent = true;
                        onClarificationRef.current?.(content);
                      }
                    }
                  }

                  // Forward last assistant message
                  const lastMsg = eventData.messages[eventData.messages.length - 1];
                  if (lastMsg && (lastMsg.type === 'ai' || lastMsg.type === 'assistant')) {
                    const content = typeof lastMsg.content === 'string'
                      ? lastMsg.content
                      : Array.isArray(lastMsg.content)
                        ? lastMsg.content.find((c: any) => c.type === 'text')?.text || ''
                        : '';
                    if (content) {
                      onMessageRef.current?.({ type: 'assistant', content });
                    }
                  }
                }
              }

              // Handle messages event (incremental token chunks)
              // LangGraph sends "messages/partial" and "messages/complete" event types
              if (
                effectiveEventType === 'messages' ||
                effectiveEventType === 'messages/partial' ||
                effectiveEventType === 'messages/complete'
              ) {
                // messages mode sends [messageObject, metadata] tuples
                const chunk = Array.isArray(eventData) ? eventData[0] : eventData;

                // Only forward AI/assistant messages (skip tool messages, human messages)
                const msgType = chunk?.type || chunk?.role;
                if (msgType === 'ai' || msgType === 'AIMessageChunk' || msgType === 'assistant') {
                  // DeepSeek Reasoner: actual content in `content`, reasoning in `additional_kwargs.reasoning_content`
                  const content = typeof chunk?.content === 'string'
                    ? chunk.content
                    : Array.isArray(chunk?.content)
                      ? chunk.content.find((c: any) => c.type === 'text')?.text || ''
                      : '';

                  const reasoning = chunk?.additional_kwargs?.reasoning_content || '';

                  if (content) {
                    // Actual response content — stream it
                    onMessageRef.current?.({ type: 'assistant', content });
                  } else if (reasoning && !content) {
                    // Still in reasoning phase — show thinking indicator
                    onMessageRef.current?.({ type: 'assistant', content: '🤔 Thinking...' });
                  }
                }
              }

            } catch (e) {
              console.warn('[LangGraph SSE] Parse error:', e, 'data:', data.slice(0, 300));
            }
          }
        }

        // Stream complete
        console.log('[LangGraph] Stream finished. Artifacts:', finalArtifacts.length);
        setIsStreaming(false);
        onFinishRef.current?.({
          artifacts: finalArtifacts,
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('[LangGraph] Stream aborted by user');
        } else {
          console.error('[LangGraph] Error:', error);
          onErrorRef.current?.(error as Error);
        }
        setIsStreaming(false);
      }
    },
    [initialThreadId, setArtifacts, setOpen, setAutoOpen],
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    submit,
    stop,
    isStreaming,
  };
}

// Helper to create a new thread
export async function ensureThreadId(): Promise<string> {
  const client = getLangGraphClient();
  const thread = await client.threads.create({});
  return thread.thread_id;
}
