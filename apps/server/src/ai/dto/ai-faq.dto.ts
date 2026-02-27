import { IsString, IsNotEmpty } from 'class-validator';

export class AiFaqStreamDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}
