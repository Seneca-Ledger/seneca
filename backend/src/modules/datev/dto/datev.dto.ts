import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class SaveDatevSettingsDto {
  @IsIn(['03', '04'])
  chart: '03' | '04';

  /** Beraternummer, 1001–9999999 per the DATEV format. */
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1001)
  @Max(9_999_999)
  consultantNumber: number | null;

  /** Mandantennummer, 1–99999. */
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(99_999)
  clientNumber: number | null;

  /** The bank account the rows are booked against; the chart's bank account when null. */
  @ValidateIf((_dto, value) => value !== null)
  @Matches(/^[0-9]{1,9}$/, { message: 'bankAccount must be 1–9 digits' })
  bankAccount: string | null;

  /** Category id → account number (1–9 digits). A missing category is not exported. */
  @IsOptional()
  @IsObject()
  accounts?: Record<string, string>;

  /** Statement account number (IBAN) → DATEV bank account; the rest book to `bankAccount`. */
  @IsOptional()
  @IsObject()
  bankAccounts?: Record<string, string>;
}

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
