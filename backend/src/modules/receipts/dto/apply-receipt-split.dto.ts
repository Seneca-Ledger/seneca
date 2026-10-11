import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

/** A receipt line as the user reviewed it: the same line, the category they settled on. */
export class ReviewedSplitItemDto {
  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class ApplyReceiptSplitDto {
  /** Without it the suggested categories are applied as they are. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewedSplitItemDto)
  items?: ReviewedSplitItemDto[];
}
