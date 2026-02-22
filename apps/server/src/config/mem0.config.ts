import { ConfigService } from '@nestjs/config';
// this version doesn't work, need to switch to python version, connect to pgvector in later phase if this feature is must to have.
export interface Mem0Config {
  vectorStore: {
    provider: 'redis' | 'qdrant' | 'pgvector' | 'supabase';
    config: {
      host?: string;
      port?: number;
      url?: string;
      dbname?: string;
      user?: string;
      password?: string;
      collectionName?: string;
      tableName?: string;
      embeddingModelDims?: number;
      supabaseUrl?: string;
      supabaseKey?: string;
    };
  };
  llm: {
    provider: 'openai';
    config: {
      apiKey: string;
      model: string;
      baseUrl: string;
    };
  };
  embedder: {
    provider: 'openai';
    config: {
      apiKey: string;
      model: string;
      baseUrl: string;
    };
  };
}

export function getMem0Config(configService: ConfigService): Mem0Config {
  const openaiApiUrl = configService.get<string>('OPENAI_API_URL') || 'https://open.bigmodel.cn/api/paas/v4';
  const openaiApiKey = configService.get<string>('OPENAI_API_KEY') || '';

  const config: Mem0Config = {
    vectorStore: {
      provider: 'supabase',
      config: {
        tableName: 'memories',
        embeddingModelDims: 1024,
        supabaseUrl: configService.get<string>('SUPABASE_URL') || '',
        supabaseKey: configService.get<string>('SUPABASE_KEY') || '',
      },
    },
    llm: {
      provider: 'openai',
      config: {
        apiKey: openaiApiKey,
        baseUrl: openaiApiUrl,
        model: configService.get<string>('AI_COMPLETION_MODEL') || 'glm-4-flash-250414',
      },
    },
    embedder: {
      provider: 'openai',
      config: {
        apiKey: openaiApiKey,
        baseUrl: openaiApiUrl,
        model: configService.get<string>('AI_EMBEDDING_MODEL') || 'embedding-2',
      },
    },
  };

  console.log('[Mem0] LLM config:', {
    provider: config.llm.provider,
    model: config.llm.config.model,
    baseUrl: config.llm.config.baseUrl,
    apiKeyPrefix: config.llm.config.apiKey ? config.llm.config.apiKey.slice(0, 10) + '...' : 'undefined',
  });
  console.log('[Mem0] Embedder config:', {
    provider: config.embedder.provider,
    model: config.embedder.config.model,
    baseUrl: config.embedder.config.baseUrl,
  });

  return config;
}
