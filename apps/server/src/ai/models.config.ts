export const MODEL_CONFIG: Record<string, { label: string, provider: string }> = {
  'glm-4.7-flash': { label: 'GLM-4.7', provider: 'openai' },
  'deepseek-chat': { label: 'DeepSeek', provider: 'openai' },
  'MiniMax-M2': { label: 'MiniMax M2', provider: 'openai' },
  'glm-4.5': { label: 'GLM-4.5 (internal)', provider: 'openai' },
};

export type ModelId = keyof typeof MODEL_CONFIG;
