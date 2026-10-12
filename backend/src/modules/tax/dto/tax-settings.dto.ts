import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TaxFilingPeriod } from '../../../entities/tax-jurisdiction.entity';
import { VatStatus } from '../../../entities/workspace.entity';

export class SetVatStatusDto {
  @IsEnum(VatStatus)
  status: VatStatus;
}

export class ReassessTaxDto {
  /** Only rows dated on or after this day; all unfiled rows when omitted. */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;
}

export class SetTaxReserveDto {
  /** Share of income to set aside for income tax, 0–100; null switches it off. */
  @ValidateIf((_dto, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percent: number | null;

  /** Expense category tax payments are booked to; null means none. */
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  paymentsCategoryId: string | null;
}

export class SetVatFilingDto {
  /** Null goes back to the jurisdiction's usual frequency. */
  @ValidateIf((_dto, value) => value !== null)
  @IsEnum(TaxFilingPeriod)
  frequency: TaxFilingPeriod | null;

  @IsBoolean()
  extension: boolean;
}

export class OfficialRateDifferenceDto {
  /** A difference's key, as the official-rates check returned it. */
  @IsString()
  @Matches(/^(standard_changed|reduced_missing|reduced_unlisted):[0-9.]+(:[0-9-]*)?$/)
  key: string;
}

export class DismissOfficialRateDto extends OfficialRateDifferenceDto {
  @IsBoolean()
  dismissed: boolean;
}
