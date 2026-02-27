import {
  IsArray,
  IsString,
  IsIn,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class AiChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  thinking?: boolean;

  @IsOptional()
  @IsArray()
  selectedPageIds?: string[];

  @IsOptional()
  @IsBoolean()
  isWebSearchEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  skipUserPersist?: boolean;  // Set true for AI regeneration (user msg already exists)
}
