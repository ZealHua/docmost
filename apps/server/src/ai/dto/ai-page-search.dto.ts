import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';

export class AiPageSearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  pageIds?: string[];
}

export class AiPageSearchResultDto {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  spaceSlug: string;
}
