import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Every field is optional: the profile is filled in over time, and `send`
 * refuses only when the fields a document cannot do without are still empty.
 */
export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  addressLines?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  paymentInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invoiceFooter?: string;

  /** The address in parts, for e-invoices. */
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

  /** Steuernummer, apart from the VAT id. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;
}
