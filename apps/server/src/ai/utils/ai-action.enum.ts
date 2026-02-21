// Mirrors the frontend AiAction enum in ee/ai/types/ai.types.ts
// Single source of truth on the backend
export enum AiAction {
  IMPROVE_WRITING = 'improve_writing',
  FIX_SPELLING_GRAMMAR = 'fix_spelling_grammar',
  MAKE_SHORTER = 'make_shorter',
  MAKE_LONGER = 'make_longer',
  SIMPLIFY = 'simplify',
  CHANGE_TONE = 'change_tone',
  SUMMARIZE = 'summarize',
  EXPLAIN = 'explain',
  CONTINUE_WRITING = 'continue_writing',
  TRANSLATE = 'translate',
  CUSTOM = 'custom',
}
