import { IsString, IsNotEmpty } from 'class-validator';

export class ClarifyObjectiveDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ClarifyObjectiveResponseDto {
  objective: string;
  originalMessage: string;
}
