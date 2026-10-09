import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
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
}
