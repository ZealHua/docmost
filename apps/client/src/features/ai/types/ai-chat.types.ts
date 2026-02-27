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

// ── LangGraph tool-call types ───────────────────────────────────
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
  type?: "tool_call";
}

export interface Todo {
  content: string;
  completed: boolean;
}

export interface SubtaskEvent {
  type: "task_running" | "task_complete" | "task_error";
  task_id: string;
  message?: {
    type: string;
    content: string;
    id: string;
  };
}

// ── Messages ────────────────────────────────────────────────────
/**
 * `messageType` discriminator:
 *   - undefined / 'chat'  → regular human or assistant text message
 *   - 'tool_use'          → AI message that contains tool_calls[]
 *   - 'tool_result'       → tool execution result
 */
export interface AiMessage {
  id: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  sources: RagSource[];
  createdAt: string;

  // LangGraph agentic fields
  messageType?: "chat" | "tool_use" | "tool_result";
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tool_name?: string;
  tool_status?: "success" | "error";
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
  type: "sources" | "chunk" | "thinking" | "error";
  data: RagSource[] | string;
}
