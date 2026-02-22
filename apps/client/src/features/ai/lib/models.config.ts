export const MODEL_CONFIG: Record<string, {
  label: string;
  provider: string;
  supportsThinking: boolean;
  thinkingModel?: string;
}> = {
  'glm-4.7-flash': { label: 'GLM-4.7', provider: 'openai', supportsThinking: true },
  'deepseek-chat': { label: 'DeepSeek', provider: 'openai', supportsThinking: true, thinkingModel: 'deepseek-reasoner' },
  'MiniMax-M2': { label: 'MiniMax M2', provider: 'openai', supportsThinking: false },
};

export type ModelId = keyof typeof MODEL_CONFIG;
