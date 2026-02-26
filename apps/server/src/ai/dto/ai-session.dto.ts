import { IsOptional, IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAiSessionDto {
  @IsOptional()
  @IsUUID()
  pageId?: string;
}

export class UpdateAiSessionTitleDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class UpdateAiSessionThreadIdDto {
  @IsString()
  @IsNotEmpty()
  threadId: string;
}

export class AiSessionResponseDto {
  id: string;
  workspaceId: string;
  pageId: string | null;
  userId: string;
  title: string | null;
  threadId?: string;
  createdAt: string;
  updatedAt: string;
  selectedPageIds?: string[];
}

export class AiMessageResponseDto {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: any[];
  createdAt: string;
}
