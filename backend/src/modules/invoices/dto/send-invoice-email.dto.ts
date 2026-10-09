import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendInvoiceEmailDto {
  /** Overrides the client's stored address for this one send. */
  @IsOptional()
  @IsEmail()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}
