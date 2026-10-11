import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  /** Language of the documents sent to this client, e.g. `de`. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  /** False leaves this client out of reminder emails. */
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  /** "Net 30" for this client; omitted follows the workspace's own term. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  /** The billing address in parts, for e-invoices. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a two-letter country code' })
  countryCode?: string;

  /** Quoted on every invoice to this client (XRechnung BT-10), e.g. a Leitweg-ID. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  buyerReference?: string;

  /** Goods or services: decides the VAT category of a reverse-charged line. */
  @IsOptional()
  @IsIn(['goods', 'services'])
  supplyType?: 'goods' | 'services';
}
