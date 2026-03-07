import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PagePermissionRole } from '../../../common/helpers/types/permission';
import { PageIdDto } from './page.dto';

export class RestrictPageDto extends PageIdDto {}

export class AddPagePermissionDto extends PageIdDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsIn([PagePermissionRole.READER, PagePermissionRole.WRITER])
  role: PagePermissionRole;
}

export class RemovePagePermissionDto extends PageIdDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class UpdatePagePermissionDto extends RemovePagePermissionDto {
  @IsIn([PagePermissionRole.READER, PagePermissionRole.WRITER])
  role: PagePermissionRole;
}
