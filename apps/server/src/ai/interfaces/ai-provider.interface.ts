export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RagChunk {
  pageId: string;
  title: string;
  slugId: string;
  spaceSlug: string;
  excerpt: string; // the actual text chunk used as context
  similarity: number;
  chunkIndex: number;
}

export interface AiProvider {
  /**
   * Non-streaming: generate text for editor actions (improve, summarize, etc.)
   * Used by POST /ai/generate
   */
  generateText(
    systemPrompt: string,
    content: string,
    model?: string,
  ): Promise<string>;

  /**
   * Streaming: generate text for editor actions with SSE chunks
   * Used by POST /ai/generate/stream
   */
  streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    model?: string,
    onError?: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * Streaming: RAG chat — takes history + retrieved chunks, streams answer
   * Used by POST /ai/chat/stream (the new citation-enabled endpoint)
   */
  streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    model?: string,
    thinking?: boolean,
    onThinking?: (thinking: string) => void,
    onError?: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * Generate vector embeddings for a list of text strings
   * Called by EmbeddingService when processing page chunks
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
