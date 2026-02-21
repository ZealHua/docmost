export const MODEL_CONFIG = {
  'glm-4.7-flash': { label: 'GLM-4.7', provider: 'openai', supportsThinking: true },
  'deepseek-chat': { label: 'DeepSeek', provider: 'openai', supportsThinking: false },
  'MiniMax-M2': { label: 'MiniMax M2', provider: 'openai', supportsThinking: true },
} as const;

export type ModelId = keyof typeof MODEL_CONFIG;
