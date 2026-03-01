import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Represents a node in the page tree hierarchy.
 * Used for rendering the page selection tree in the AI chat interface.
 */
export class PageTreeItem {
  @IsUUID()
  id: string;

  @IsString()
  title: string | null;

  @IsString()
  icon: string | null;

  @IsUUID()
  slugId: string;

  @IsUUID()
  spaceId: string;

  @IsUUID()
  @IsOptional()
  parentPageId: string | null;

  children: PageTreeItem[];
}

/**
 * Query DTO for fetching page tree.
 */
export class GetPageTreeDto {
  @IsUUID()
  spaceId: string;
}