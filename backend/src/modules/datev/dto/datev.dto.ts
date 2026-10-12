import { Type } from 'class-transformer';
import { IsInt, IsISO8601, Max, Min } from 'class-validator';

export class DatevPeriodDto {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;
}

export class DatevMappingQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}
