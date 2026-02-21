import { IsString, IsOptional, IsUUID } from 'class-validator';

export class AiPageSearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export class AiPageSearchResultDto {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  spaceSlug: string;
}
