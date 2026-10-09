import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IMPORT_TARGET_KINDS, type ImportTargetKind } from '../target-aliases';

export const IMPORT_ROWS_MAX = 5000;

export class EntityImportOptionsDto {
  /** Fallback currency for rows that carry none. */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** Transactions only: run the categorizer over rows without a category. */
  @IsOptional()
  @IsBoolean()
  categorize?: boolean;
}

export class RunEntityImportDto {
  @IsIn(IMPORT_TARGET_KINDS)
  target: ImportTargetKind;

  /** Target field → column index in `rows`. */
  @IsObject()
  mapping: Record<string, number>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_ROWS_MAX)
  rows: string[][];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  /** Validate and count only; nothing is written. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EntityImportOptionsDto)
  options?: EntityImportOptionsDto;
}
