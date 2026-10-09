import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : value;

export class CashFlowMapQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Also show the period of the same length right before, per category. */
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  compare?: boolean;

  /** Count transfers and investment contributions as a flow out of the total. */
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  includeTransfers?: boolean;

  /** Category ids to keep (root or leaf); empty means every category. */
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(',')
          .map((part: string) => part.trim())
          .filter(Boolean),
  )
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';

  /**
   * Whose rows to count: `me`, `shared` for the ones nobody claimed, or a
   * membership id. Left out, the whole workspace is counted.
   */
  @IsOptional()
  @IsString()
  owner?: string;
}
