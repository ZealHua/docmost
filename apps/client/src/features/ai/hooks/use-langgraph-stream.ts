import { useCallback, useRef, useState } from 'react';
import { getLangGraphClient } from '@/lib/langgraph-client';
import { useArtifacts } from '../context/artifacts-context';
import { LANGGRAPH_BASE_URL } from '@/lib/langgraph-client';
import { Todo, SubtaskEvent } from '../types/ai-chat.types';

export interface LangGraphMessage {
  type: string;
  content: string;
  id?: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; id: string }>;
}

export interface LangGraphState {
  artifacts?: string[];
  messages?: LangGraphMessage[];
  title?: string;
  todos?: Todo[];
  uploaded_files?: Array<{ filename: string; path: string; virtual_path: string; artifact_url: string }>;
  viewed_images?: string[];
  /** Backend-assigned ID of the last AI message (e.g. lc_run--uuid) */
  lastMessageId?: string;
}

export interface SubmitInput {
  messages: Array<{ type: string; content: string }>;
}

export interface SubmitCommand {
  resume: { answer: string };
}

export interface UseLangGraphStreamOptions {
  threadId: string | null;
  onMessage?: (message: LangGraphMessage) => void;
  onClarification?: (content: string) => void;
  onTaskProgress?: (event: SubtaskEvent) => void;
  onFinish?: (state: LangGraphState) => void;
  onError?: (error: Error) => void;
}

export function useLangGraphStream({
  threadId: initialThreadId,
  onMessage,
  onClarification,
  onTaskProgress,
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
  const onTaskProgressRef = useRef(onTaskProgress);
  onTaskProgressRef.current = onTaskProgress;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const submit = useCallback(
    async (
      input: SubmitInput | null,
      threadId?: string,
      command?: SubmitCommand,
    ) => {
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

      try {
        const payload: Record<string, unknown> = {
          assistant_id: assistantId,
          stream_mode: ['values', 'messages-tuple', 'custom'],
          config: {
            recursion_limit: 1000,
            configurable: {
              model_name: modelName,
              thinking_enabled: thinkingEnabled,
              is_plan_mode: true,
              subagent_enabled: false,
              thread_id: actualThreadId,
            },
          },
        };

        // Use command.resume for clarification answers, input.messages for new messages
        if (command) {
          payload.command = command;
        } else if (input) {
          payload.input = {
            messages: input.messages.map((msg) => ({
              role: msg.type === 'human' ? 'user' : 'assistant',
              content: msg.content,
            })),
          };
        }

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
          // Parse structured error `{ detail: "..." }` if possible
          let errorMessage = `HTTP ${response.status}: ${errorText}`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.detail) {
              errorMessage = `HTTP ${response.status}: ${parsed.detail}`;
            }
          } catch {
            // Raw text is fine
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is null');
        }

        let currentEventType = '';
        let buffer = '';
        let finalArtifacts: string[] = [];
        let finalTitle: string | undefined;
        let finalTodos: Todo[] = [];
        // Track seen clarification message IDs to avoid duplicates across values snapshots
        const seenClarificationIds = new Set<string>();
        // Fix #8: Accumulate message content for delta-based stream modes
        let messageAccumulator = '';
        // Fix #14: Track backend-assigned message ID
        let lastMessageId: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Handle event type line
            if (trimmedLine.startsWith('event:')) {
              currentEventType = trimmedLine.slice(6).trim();

              // Handle end event — stream is complete
              if (currentEventType === 'end') {
                // The end event may or may not have a data line; we don't need to wait
                continue;
              }
              continue;
            }

            // Handle data line
            if (!trimmedLine.startsWith('data:')) continue;

            const data = trimmedLine.slice(5).trim();

            if (data === '[DONE]') {
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
              }

              // ── values event (full state snapshot) ──────────────────
              if (effectiveEventType === 'values') {
                // Extract artifacts
                const artifacts = eventData?.artifacts;
                if (artifacts && Array.isArray(artifacts) && artifacts.length > 0) {
                  finalArtifacts = artifacts;
                  setArtifacts(artifacts);
                  setAutoOpen(true);
                  setOpen(true);
                }

                // Extract title
                if (eventData?.title && typeof eventData.title === 'string') {
                  finalTitle = eventData.title;
                }

                // Extract todos
                if (eventData?.todos && Array.isArray(eventData.todos)) {
                  finalTodos = eventData.todos;
                }

                // Scan for clarification ToolMessages
                if (eventData.messages && Array.isArray(eventData.messages)) {
                  for (const msg of eventData.messages) {
                    if (msg.type === 'tool' && msg.name === 'ask_clarification') {
                      const msgId = msg.id || msg.tool_call_id || '';
                      const content = typeof msg.content === 'string' ? msg.content : '';
                      if (content && !seenClarificationIds.has(msgId)) {
                        seenClarificationIds.add(msgId);
                        onClarificationRef.current?.(content);
                      }
                    }
                  }

                  // Forward last assistant message — values is a full snapshot, so overwrite
                  const lastMsg = eventData.messages[eventData.messages.length - 1];
                  if (lastMsg && (lastMsg.type === 'ai' || lastMsg.type === 'assistant')) {
                    const content = typeof lastMsg.content === 'string'
                      ? lastMsg.content
                      : Array.isArray(lastMsg.content)
                        ? lastMsg.content.find((c: any) => c.type === 'text')?.text || ''
                        : '';
                    if (content) {
                      // values = full snapshot → overwrite accumulator
                      messageAccumulator = content;
                      lastMessageId = lastMsg.id;
                      onMessageRef.current?.({
                        type: 'assistant',
                        content: messageAccumulator,
                        id: lastMsg.id,
                        tool_calls: lastMsg.tool_calls,
                      });
                    }
                  }
                }
              }

              // ── messages-tuple event ([message_id, partial_content]) ──
              if (effectiveEventType === 'messages-tuple') {
                // Format: [message_id, {content: "delta", role: "assistant", ...}]
                if (Array.isArray(eventData) && eventData.length === 2) {
                  const [msgId, msgPayload] = eventData;
                  const msgType = msgPayload?.type || msgPayload?.role;
                  if (msgType === 'ai' || msgType === 'AIMessageChunk' || msgType === 'assistant') {
                    const delta = typeof msgPayload?.content === 'string'
                      ? msgPayload.content
                      : Array.isArray(msgPayload?.content)
                        ? msgPayload.content.find((c: any) => c.type === 'text')?.text || ''
                        : '';

                    if (delta) {
                      // messages-tuple sends deltas → append to accumulator
                      messageAccumulator += delta;
                      lastMessageId = msgPayload?.id || msgId;
                      onMessageRef.current?.({ type: 'assistant', content: messageAccumulator, id: lastMessageId });
                    } else {
                      const reasoning = msgPayload?.additional_kwargs?.reasoning_content || '';
                      if (reasoning) {
                        onMessageRef.current?.({ type: 'assistant', content: messageAccumulator || '🤔 Thinking...', id: lastMessageId });
                      }
                    }
                  }
                }
              }

              // ── messages event (backward compat — incremental token chunks) ──
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
                  const delta = typeof chunk?.content === 'string'
                    ? chunk.content
                    : Array.isArray(chunk?.content)
                      ? chunk.content.find((c: any) => c.type === 'text')?.text || ''
                      : '';

                  const reasoning = chunk?.additional_kwargs?.reasoning_content || '';

                  if (delta) {
                    // messages sends deltas → append to accumulator
                    messageAccumulator += delta;
                    lastMessageId = chunk?.id || lastMessageId;
                    onMessageRef.current?.({
                      type: 'assistant',
                      content: messageAccumulator,
                      id: lastMessageId,
                      tool_calls: chunk?.tool_calls,
                    });
                  } else if (reasoning) {
                    onMessageRef.current?.({ type: 'assistant', content: messageAccumulator || '🤔 Thinking...', id: lastMessageId });
                  }
                }
              }

              // ── custom event (subtask progress) ──────────────────────
              if (effectiveEventType === 'custom') {
                const subtaskEvent: SubtaskEvent = {
                  type: eventData?.type || 'task_running',
                  task_id: eventData?.task_id || '',
                  message: eventData?.message,
                };
                onTaskProgressRef.current?.(subtaskEvent);
              }

            } catch (e) {
              console.warn('[LangGraph] SSE parse error:', (e as Error).message);
            }
          }
        }

        // Stream complete
        setIsStreaming(false);
        onFinishRef.current?.({
          artifacts: finalArtifacts,
          title: finalTitle,
          todos: finalTodos,
          lastMessageId,
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled, no action needed
        } else {
          console.error('[LangGraph] Stream error:', error);
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
