import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AiAction } from '../utils/ai-action.enum';

export class AiGenerateDto {
  @IsOptional()
  @IsEnum(AiAction)
  action?: AiAction;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
