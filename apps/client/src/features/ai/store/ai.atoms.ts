import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { AiMessage, AiSession, RagSource } from '../types/ai-chat.types';
import { AiPageSearchResult } from '../hooks/use-ai-page-search';

// Active session (writable atom)
export const aiActiveSessionAtom = atom<AiSession | null>(null);

// Selected model (persisted to localStorage)
export const aiSelectedModelAtom = atomWithStorage<string>(
  'docmost_ai_selected_model',
  'glm-4.7-flash',
);

// Extended thinking (persisted to localStorage)
export const aiThinkingAtom = atomWithStorage<boolean>(
  'docmost_ai_thinking',
  false,
);

// Selected pages for AI chat (user explicitly selected for context)
export const aiSelectedPagesAtom = atom<AiPageSearchResult[]>([]);

// Messages for the active session (loaded from DB + live streaming)
export const aiMessagesAtom = atom<AiMessage[]>([]);

// Sources returned by the LAST RAG call — used to resolve [^n] citations.
// Reset at the start of each new user message.
export const aiSourcesAtom = atom<RagSource[]>([]);

// Streaming state
export const aiIsStreamingAtom = atom<boolean>(false);

// Accumulates text chunks during streaming — cleared on each new message
export const aiStreamingContentAtom = atom<string>('');

// Streaming thinking content — cleared on each new message
export const aiStreamingThinkingAtom = atom<string>('');

// Sessions list for the sidebar header/history view (populated in Step 12)
export const aiSessionsAtom = atom<AiSession[]>([]);
