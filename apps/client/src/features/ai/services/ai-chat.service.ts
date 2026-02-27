import { AiStreamEvent, RagSource } from "../types/ai-chat.types";
import api from "@/lib/api-client";

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
  skipUserPersist?: boolean;  // Set true for AI regeneration (user msg already exists)
}

/**
 * Truncate messages from a specific message onwards.
 * Used when editing a message to remove it and all subsequent messages.
 */
export async function truncateMessages(
  sessionId: string,
  fromMessageId: string,
): Promise<void> {
  await api.delete(`/ai/sessions/${sessionId}/messages/${fromMessageId}/truncate`);
}

/**
 * Consumes the /api/ai/chat/stream SSE endpoint.
 * Parses two event types:
 *   { type: 'sources', data: RagSource[] }  — emitted before the answer starts
 *   { type: 'chunk',   data: string }        — text delta
 *   { type: 'error',   data: string }        — error message
 *
 * Returns an AbortController immediately — call .abort() to cancel the stream.
 */
export function streamAiChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): AbortController {
  const abortController = new AbortController();

  // Fire-and-forget the stream processing — we return the controller synchronously
  (async () => {
    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          sessionId: options?.sessionId,
          model: options?.model,
          thinking: options?.thinking,
          selectedPageIds: options?.selectedPageIds,
          isWebSearchEnabled: options?.isWebSearchEnabled,
          skipUserPersist: options?.skipUserPersist,
        }),
        signal: abortController.signal,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            if (raw === "[DONE]") {
              callbacks.onComplete();
              return;
            }

            try {
              const event: AiStreamEvent = JSON.parse(raw);
              if (event.type === "sources") {
                callbacks.onSources(event.data as RagSource[]);
              } else if (event.type === "chunk") {
                callbacks.onChunk(event.data as string);
              } else if (event.type === "thinking") {
                callbacks.onThinking(event.data as string);
              } else if (event.type === "error") {
                callbacks.onError(event.data as string);
                return;
              } else if (event.type === "memory") {
                const memoryData = event.data as {
                  enabled?: boolean;
                  loaded?: boolean;
                };
                callbacks.onMemory?.({
                  enabled: !!memoryData.enabled,
                  loaded: !!memoryData.loaded,
                });
              }
            } catch (parseError) {
              console.warn("Failed to parse SSE event:", raw, parseError);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Stream error:", err);
          callbacks.onError(err.message);
        }
        // AbortError → user cancelled, no callback needed
      } finally {
        reader?.releaseLock();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Fetch error:", err);
        callbacks.onError(err.message);
      }
    }
  })();

  return abortController;
}
