import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, Min } from 'class-validator';

const toBooleanValue = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
};

const toNumberValue = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export class BaseReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['income', 'expense', 'all'])
  type?: 'income' | 'expense' | 'all';

  @IsOptional()
  @IsString()
  statuses?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @Transform(toNumberValue)
  @Min(0)
  amountMin?: number;

  @IsOptional()
  @Transform(toNumberValue)
  @Min(0)
  amountMax?: number;

  @IsOptional()
  @IsString()
  currencies?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBooleanValue)
  approved?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBooleanValue)
  billable?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBooleanValue)
  exported?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBooleanValue)
  paid?: boolean;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  counterparties?: string;

  /**
   * Whose rows to count: `me`, `shared` for the ones nobody claimed, or a
   * membership id. Left out, the whole workspace is counted.
   */
  @IsOptional()
  @IsString()
  owner?: string;
}
