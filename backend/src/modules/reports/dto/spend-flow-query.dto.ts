import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SpendFlowQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';

  /** Sankey shape: top spenders, top categories or top merchants. */
  @IsOptional()
  @IsIn(['category-merchant', 'category-subcategory', 'merchant'])
  groupBy?: 'category-merchant' | 'category-subcategory' | 'merchant';

  /** Comma-separated statement statuses. */
  @IsOptional()
  @IsString()
  statuses?: string;

  /** Comma-separated statement bank names. */
  @IsOptional()
  @IsString()
  bankNames?: string;

  /** The page's Type chip: a statement file type, "gmail" or "receipt". */
  @IsOptional()
  @IsString()
  documentType?: string;

  /** Comma-separated ids of the users who uploaded the statements ("From"). */
  @IsOptional()
  @IsString()
  userIds?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(10)
  merchantsPerCategory?: number;

  /**
   * Whose rows to count: `me`, `shared` for the ones nobody claimed, or a
   * membership id. Left out, the whole workspace is counted.
   */
  @IsOptional()
  @IsString()
  owner?: string;
}
