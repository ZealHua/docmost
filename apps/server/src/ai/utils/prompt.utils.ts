import { RagChunk } from '../interfaces/ai-provider.interface';
import { AiAction } from './ai-action.enum';

/**
 * Builds the system prompt for RAG chat.
 * Sources are numbered — the model is instructed to cite using [^n] notation.
 * The frontend AiCitationRenderer maps [^n] back to source metadata.
 */
export function buildRagSystemPrompt(chunks: RagChunk[]): string {
  const sourceBlocks = chunks
    .map(
      (c, i) =>
        `[^${i + 1}] (Page: "${c.title}", path: /docs/${c.slugId}):\n"${c.excerpt}"`,
    )
    .join('\n\n');

  return `You are a helpful assistant with access to the workspace knowledge base.
Use the following document excerpts as your primary sources.
Cite them inline using [^1], [^2] notation. Only cite when directly relevant.
If the sources do not contain the answer, say so clearly.

${sourceBlocks}`;
}

/**
 * Builds the system prompt for editor-action generation (improve, summarize, etc.)
 */
export function buildEditorSystemPrompt(
  action: AiAction,
  extraPrompt?: string,
): string {
  const prompts: Record<AiAction, string> = {
    [AiAction.IMPROVE_WRITING]:
      'Improve the writing of the following text. Return only the improved text without explanations.',
    [AiAction.FIX_SPELLING_GRAMMAR]:
      'Fix all spelling and grammar errors in the following text. Return only the corrected text.',
    [AiAction.MAKE_SHORTER]:
      'Make the following text shorter while preserving the key meaning. Return only the shortened text.',
    [AiAction.MAKE_LONGER]:
      'Expand the following text with more detail. Return only the expanded text.',
    [AiAction.SIMPLIFY]:
      'Simplify the following text so it is easy to understand. Return only the simplified text.',
    [AiAction.CHANGE_TONE]: `Rewrite the following text in a ${extraPrompt ?? 'professional'} tone. Return only the rewritten text.`,
    [AiAction.SUMMARIZE]:
      'Summarize the following text in a concise paragraph. Return only the summary.',
    [AiAction.EXPLAIN]:
      'Explain the following text in simple terms. Return only the explanation.',
    [AiAction.CONTINUE_WRITING]:
      'Continue writing from where the following text ends. Return only the continuation.',
    [AiAction.TRANSLATE]: `Translate the following text to ${extraPrompt ?? 'English'}. Return only the translation.`,
    [AiAction.CUSTOM]: extraPrompt ?? 'Process the following text as requested.',
  };
  return prompts[action] ?? prompts[AiAction.CUSTOM];
}
