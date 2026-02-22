import { AiStreamEvent, RagSource } from '../types/ai-chat.types';

interface StreamCallbacks {
  onSources: (sources: RagSource[]) => void;
  onChunk: (chunk: string) => void;
  onThinking: (thinking: string) => void;
  onError: (error: string) => void;
  onComplete: () => void;
  onMemory?: (memory: { enabled: boolean; loaded: boolean }) => void;
}

interface StreamOptions {
  sessionId?: string;
  model?: string;
  thinking?: boolean;
  selectedPageIds?: string[];
  isWebSearchEnabled?: boolean;
}

/**
 * Consumes the /api/ai/chat/stream SSE endpoint.
 * Parses two event types:
 *   { type: 'sources', data: RagSource[] }  — emitted before the answer starts
 *   { type: 'chunk',   data: string }        — text delta
 *   { type: 'error',   data: string }        — error message
 *
 * Returns an AbortController — call .abort() to cancel the stream.
 */
export async function streamAiChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<AbortController> {
  const abortController = new AbortController();

  try {
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        sessionId: options?.sessionId,
        model: options?.model,
        thinking: options?.thinking,
        selectedPageIds: options?.selectedPageIds,
        isWebSearchEnabled: options?.isWebSearchEnabled,
      }),
      signal: abortController.signal,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    const processStream = async () => {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === '[DONE]') {
              callbacks.onComplete();
              return;
            }

            try {
              const event: AiStreamEvent = JSON.parse(raw);
              if (event.type === 'sources') {
                callbacks.onSources(event.data as RagSource[]);
              } else if (event.type === 'chunk') {
                callbacks.onChunk(event.data as string);
              } else if (event.type === 'thinking') {
                callbacks.onThinking(event.data as string);
              } else if (event.type === 'error') {
                callbacks.onError(event.data as string);
                return; // Stop processing on error
              } else if (event.type === 'memory') {
                const memoryData = event.data as { enabled?: boolean; loaded?: boolean };
                callbacks.onMemory?.({ enabled: !!memoryData.enabled, loaded: !!memoryData.loaded });
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', raw, parseError);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Stream error:', err);
          callbacks.onError(err.message);
        }
      } finally {
        reader?.releaseLock();
      }
    };

    // Await the stream processing to ensure errors are caught
    await processStream();
  } catch (err: any) {
    console.error('Fetch error:', err);
    callbacks.onError(err.message);
  }

  return abortController;
}
