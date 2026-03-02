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

// ── Messages ────────────────────────────────────────────────────
export interface AiMessage {
  id: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  sources: RagSource[];
  createdAt: string;
}

export interface AiSession {
  id: string;
  workspaceId: string;
  pageId: string | null;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  selectedPageIds?: string[];
}

export interface AiStreamEvent {
  type: "sources" | "chunk" | "thinking" | "error";
  data: RagSource[] | string;
}
