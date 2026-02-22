import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Memory } from 'mem0ai/oss';
import { getMem0Config } from '@/config/mem0.config';

export interface Mem0Memory {
  id: string;
  memory: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Mem0AddResult {
  results?: Array<{
    id: string;
    memory: string;
    status?: string;
  }>;
  message?: string;
}

@Injectable()
export class Mem0Service implements OnModuleInit {
  private readonly logger = new Logger(Mem0Service.name);
  private memory: Memory;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const enabled = this.configService.get<string>('MEM0_ENABLED');
    if (enabled !== 'true') {
      this.logger.warn('Mem0 is disabled. Set MEM0_ENABLED=true to enable.');
      return;
    }

    try {
      const config = getMem0Config(this.configService);
      console.log('[Mem0] Initializing with config (apiKey hidden):', JSON.stringify({
        ...config,
        llm: { ...config.llm, config: { ...config.llm.config, apiKey: config.llm.config.apiKey ? '***' : undefined } },
        embedder: { ...config.embedder, config: { ...config.embedder.config, apiKey: config.embedder.config.apiKey ? '***' : undefined } },
      }));
      this.memory = new Memory(config);
      this.isInitialized = true;
      this.logger.log('Mem0 initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Mem0: ${error?.message || error}`, error);
    }
  }

  isEnabled(): boolean {
    return this.isInitialized;
  }

  async addMemory(
    messages: { role: string; content: string }[],
    userId: string,
  ): Promise<Mem0AddResult> {
    if (!this.isInitialized) {
      this.logger.warn('Mem0 not initialized, skipping addMemory');
      return { message: 'Mem0 not enabled' };
    }

    try {
      const result = await this.memory.add(messages, { userId });
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to add memory: ${error?.message || error}`, error);
      throw error;
    }
  }

  async getAllMemory(userId: string): Promise<Mem0Memory[]> {
    if (!this.isInitialized) {
      this.logger.warn('Mem0 not initialized, skipping getAllMemory');
      return [];
    }

    try {
      const result = await this.memory.getAll({ userId });
      return result.results || [];
    } catch (error) {
      this.logger.error('Failed to get all memories', error);
      throw error;
    }
  }

  async searchMemory(
    query: string,
    userId: string,
  ): Promise<Mem0Memory[]> {
    if (!this.isInitialized) {
      this.logger.warn('Mem0 not initialized, skipping searchMemory');
      return [];
    }

    try {
      const result = await this.memory.search(query, { userId });
      return result.results || [];
    } catch (error) {
      this.logger.error('Failed to search memories', error);
      throw error;
    }
  }

  async deleteMemory(memoryId: string): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Mem0 not initialized, skipping deleteMemory');
      return;
    }

    try {
      await this.memory.delete(memoryId);
    } catch (error) {
      this.logger.error('Failed to delete memory', error);
      throw error;
    }
  }
}
