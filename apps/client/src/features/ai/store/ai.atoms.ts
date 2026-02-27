import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  AiMessage,
  AiSession,
  RagSource,
  Todo,
  SubtaskEvent,
} from "../types/ai-chat.types";
import { AiPageSearchResult } from "../hooks/use-ai-page-search";

// Active session (writable atom)
export const aiActiveSessionAtom = atom<AiSession | null>(null);

// Selected model (persisted to localStorage)
export const aiSelectedModelAtom = atomWithStorage<string>(
  "docmost_ai_selected_model",
  "glm-4.7-flash",
);

// Extended thinking (persisted to localStorage)
export const aiThinkingAtom = atomWithStorage<boolean>(
  "docmost_ai_thinking",
  false,
);

// Web Search enabled toggle (persisted to localStorage)
export const aiWebSearchEnabledAtom = atomWithStorage<boolean>(
  "docmost_ai_web_search",
  false,
);

// Selected pages for AI chat (user explicitly selected for context)
export const aiSelectedPagesAtom = atom<AiPageSearchResult[]>([]);

// Messages for the active session (loaded from DB + live streaming)
export const aiMessagesAtom = atom<AiMessage[]>([]);

// ID of the message whose sources are being viewed in the sidebar
export const aiActiveSourceMessageIdAtom = atom<string | null>(null);

// Controls the visibility of the source sidebar
export const aiSourceSidebarOpenAtom = atom<boolean>(false);

// Sources returned by the LAST RAG call — used to resolve [^n] citations.
// Reset at the start of each new user message.
export const aiSourcesAtom = atom<RagSource[]>([]);

// Streaming state
export const aiIsStreamingAtom = atom<boolean>(false);

// Accumulates text chunks during streaming — cleared on each new message
export const aiStreamingContentAtom = atom<string>("");

// Streaming thinking content — cleared on each new message
export const aiStreamingThinkingAtom = atom<string>("");

// Sessions list for the sidebar header/history view (populated in Step 12)
export const aiSessionsAtom = atom<AiSession[]>([]);

// Mem0 Memory atoms
export interface Mem0Memory {
  id: string;
  memory: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const aiMemoriesAtom = atom<Mem0Memory[]>([]);
export const aiMemoryLoadedAtom = atom<boolean>(false);
export const aiMemoryErrorAtom = atom<string | null>(null);

// Design mode for agentic flow
export const aiDesignModeAtom = atom<boolean>(false);

// LangGraph thread ID for design flow
export const aiThreadIdAtom = atom<string | null>(null);

// LangGraph agent todos (from thread state)
export const aiTodosAtom = atom<Todo[]>([]);

// Real-time subtask progress from custom SSE events
export const aiSubtaskProgressAtom = atom<SubtaskEvent[]>([]);
