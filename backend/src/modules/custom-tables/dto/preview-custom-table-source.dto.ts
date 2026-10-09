import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { CUSTOM_TABLE_SOURCE_KINDS, type CustomTableSourceKind } from '../sources/source.types';
import { SourceFiltersDto } from './source-filters.dto';

export class PreviewCustomTableSourceDto {
  @IsIn(CUSTOM_TABLE_SOURCE_KINDS)
  kind: CustomTableSourceKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFiltersDto)
  filters?: SourceFiltersDto;

  /** Translated column titles per source field; English fallback otherwise. */
  @IsOptional()
  @IsObject()
  columnTitles?: Record<string, string>;
}
