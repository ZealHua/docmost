import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class DeepResearchDto {
  @IsArray()
  @Type(() => Object)
  messages: ResearchMessage[];

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsBoolean()
  isWebSearchEnabled: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedPageIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  clarificationRound?: number;
}

export class ContinueDeepResearchDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  clarificationAnswer: string;

  @IsArray()
  @Type(() => Object)
  messages: ResearchMessage[];
}
