import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { InvestmentMetal, MetalWeightUnit } from '../../../entities/investment-holding.entity';

/**
 * A lot of physical metal. Everything is optional so the same shape serves a
 * PATCH; what a new lot cannot do without is checked in the service.
 */
export class UpsertMetalLotDto {
  @IsEnum(InvestmentMetal)
  @IsOptional()
  metal?: InvestmentMetal;

  /** Free text: "Krugerrand 2024", "bar 100 g". Built from the metal when absent. */
  @IsString()
  @Length(1, 255)
  @IsOptional()
  name?: string;

  /** How many pieces the lot holds. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  /** Gross weight of one piece. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitWeight?: number;

  @IsEnum(MetalWeightUnit)
  @IsOptional()
  weightUnit?: MetalWeightUnit;

  /** Fineness as a fraction: 0.9999, 0.925, 0.9167 — never 999 or 925. */
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  @IsOptional()
  purity?: number;

  @IsDateString()
  @IsOptional()
  acquiredOn?: string;

  /** Total paid, premium, tax and shipping included. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  costTotal?: number;

  @IsString()
  @Length(3, 10)
  @IsOptional()
  costCurrency?: string;

  @IsString()
  @Length(1, 255)
  @IsOptional()
  counterparty?: string;

  /** A hand-entered spot price per fine troy ounce; omitted, the quote is fetched. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @Length(3, 10)
  @IsOptional()
  priceCurrency?: string;

  /** Where the lot is kept; free text, blank clears it. */
  @IsString()
  @Length(0, 255)
  @IsOptional()
  storageLocation?: string;

  /** What it is insured for, which is rarely what it is worth. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  insuredValue?: number;

  @IsString()
  @Length(3, 10)
  @IsOptional()
  insuredCurrency?: string;

  /** The receipt proving the purchase; null unlinks it. */
  @IsUUID()
  @IsOptional()
  receiptId?: string | null;

  /** Whose metal it is; must be a member of this workspace. Null clears it. */
  @IsUUID()
  @IsOptional()
  ownerUserId?: string | null;
}
