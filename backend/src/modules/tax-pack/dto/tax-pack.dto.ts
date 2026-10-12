import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class TaxYearReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}

export class TaxPackQueryDto {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;

  /** `relevant` (default): rows marked tax relevant; `all`: every counted row. */
  @IsOptional()
  @IsIn(['relevant', 'all'])
  scope?: 'relevant' | 'all';
}
