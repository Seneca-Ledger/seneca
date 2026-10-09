import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewFormulaDto {
  @IsString()
  @MaxLength(500)
  expression: string;

  /** Key of the column being edited, so its own old formula is not treated as a dependency. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  columnKey?: string;

  /** `table` previews a summary (no current row, only column totals). */
  @IsOptional()
  @IsIn(['row', 'table'])
  scope?: 'row' | 'table';
}
