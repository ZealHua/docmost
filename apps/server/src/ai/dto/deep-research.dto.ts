import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ResearchPlan } from '../services/planning.service';

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

  @IsOptional()
  @IsString()
  templateId?: string;

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

  @IsOptional()
  @IsUUID()
  researchSessionId?: string;

  @IsOptional()
  @Type(() => Object)
  approvedPlan?: ResearchPlan;
}

export class ContinueDeepResearchDto {
  @IsUUID()
  researchSessionId: string;

  @IsOptional()
  @IsString()
  expectedPlanHash?: string;

  @IsOptional()
  @Type(() => Object)
  approvedPlan?: ResearchPlan;
}

export class RejectDeepResearchDto {
  @IsUUID()
  researchSessionId: string;
}
