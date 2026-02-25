// Note: AiAction is already defined in ee/ai/types/ai.types.ts
// These are the NEW types for the persistent chat sidebar

export interface RagSource {
  pageId: string;
  title: string;
  slugId: string;
  spaceSlug: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
  url?: string;
}

export interface AiMessage {
  id: string;
  // sessionId is optional at the client side until Step 12 persists sessions.
  // Do not treat '' as a valid FK value — it is a local-only placeholder.
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  sources: RagSource[]; // stored in JSONB, loaded with message
  createdAt: string;
}

export interface AiSession {
  id: string;
  workspaceId: string;
  pageId: string | null;
  userId: string;
  title: string | null;
  threadId?: string; // LangGraph thread ID for agentic flows
  createdAt: string;
  updatedAt: string;
  selectedPageIds?: string[];
}

export interface AiStreamEvent {
  type: 'sources' | 'chunk' | 'thinking' | 'error';
  data: RagSource[] | string;
}
