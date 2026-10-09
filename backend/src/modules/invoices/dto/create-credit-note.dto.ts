import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreditNoteApplicationDto {
  @IsUUID()
  invoiceId: string;

  /** How much of this invoice to credit; everything still creditable by default. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;
}

export class CreateCreditNoteDto {
  /** Today when omitted. */
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /** The invoices this note credits — one document may cover several. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteApplicationDto)
  applications: CreditNoteApplicationDto[];
}
