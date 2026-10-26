import { IsDateString, IsOptional } from 'class-validator';

/** `GET /budgets`: spending is measured for the period this day falls in. */
export class BudgetListQueryDto {
  /** `YYYY-MM-DD`; defaults to today. */
  @IsDateString()
  @IsOptional()
  date?: string;
}
