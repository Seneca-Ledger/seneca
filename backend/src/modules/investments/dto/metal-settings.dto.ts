import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

/** Percent below spot a dealer pays, per metal. */
class DealerDiscountDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  @IsOptional()
  XAU?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  @IsOptional()
  XAG?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  @IsOptional()
  XPT?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  @IsOptional()
  XPD?: number;
}

export class MetalSettingsDto {
  @ValidateNested()
  @Type(() => DealerDiscountDto)
  @IsOptional()
  dealerDiscount?: DealerDiscountDto;
}
