import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomTableSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  /** Formula over column totals, e.g. `SUM([income]) - SUM([expense])`. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  expression: string;
}

export class UpdateCustomTableSummariesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CustomTableSummaryDto)
  summaries: CustomTableSummaryDto[];
}
