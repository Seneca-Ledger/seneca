import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class InvoiceLineItemDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsUUID()
  taxRateId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Unit of measure, UN/ECE Recommendation 20 (C62 one, HUR hour, DAY day…). */
  @IsOptional()
  @Matches(/^[A-Z0-9]{1,3}$/)
  unitCode?: string;

  /** Discount (negative) or surcharge (positive) on quantity × unit price, in percent. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-100)
  @Max(1000)
  adjustmentPercent?: number;
}
