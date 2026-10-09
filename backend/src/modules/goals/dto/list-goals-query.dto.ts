import { IsOptional, IsString, Matches } from 'class-validator';

export class ListGoalsQueryDto {
  /**
   * Narrows the list to goals that were actually moved forward in this
   * calendar month, `YYYY-MM`. Without it the whole list comes back.
   */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  @IsOptional()
  month?: string;
}
