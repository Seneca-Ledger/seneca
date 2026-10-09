import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

/** Selling a lot, whole or in part. A gift is a sale for nothing. */
export class SellMetalLotDto {
  /** Pieces to sell; the whole lot when omitted. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  /** What it was sold for; zero for a gift. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  proceeds?: number;

  @IsString()
  @Length(3, 10)
  @IsOptional()
  proceedsCurrency?: string;

  @IsDateString()
  @IsOptional()
  soldOn?: string;

  @IsString()
  @Length(1, 255)
  @IsOptional()
  counterparty?: string;
}
