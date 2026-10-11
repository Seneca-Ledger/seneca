import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CategoryType, StoicClass } from '../../../entities/category.entity';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  /** Null clears the user's choice and returns the category to the suggestion
   * (IsOptional lets null through). */
  @IsEnum(StoicClass)
  @IsOptional()
  stoicClass?: StoicClass | null;

  /** Null returns the category to the name-based guess. */
  @IsBoolean()
  @IsOptional()
  helpsOthers?: boolean | null;

  /** Spending here matters for the tax return: shown in the tax-year report and the tax pack. */
  @IsBoolean()
  @IsOptional()
  taxRelevant?: boolean;
}
