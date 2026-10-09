import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

class MemberPermissionsDto {
  @IsOptional()
  @IsBoolean()
  canEditStatements?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditCustomTables?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditCategories?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditDataEntry?: boolean;

  @IsOptional()
  @IsBoolean()
  canShareFiles?: boolean;
}

/**
 * Replaces a member's toggles wholesale: a key left out is a right not granted,
 * because a missing toggle means "no" everywhere in the authz table.
 */
export class UpdateMemberPermissionsDto {
  @ValidateNested()
  @Type(() => MemberPermissionsDto)
  permissions: MemberPermissionsDto;
}
