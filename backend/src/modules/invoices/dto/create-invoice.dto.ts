import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceRecurrenceInterval } from '../../../entities/invoice.entity';
import { InvoiceLineItemDto } from './invoice-line-item.dto';

export class CreateInvoiceDto {
  @IsUUID()
  clientId: string;

  @IsDateString()
  issueDate: string;

  /** Omitted: derived from the issue date and the client's payment terms. */
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** True when the line prices already contain their tax. */
  @IsOptional()
  @IsBoolean()
  pricesIncludeTax?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];

  @IsOptional()
  @IsEnum(InvoiceRecurrenceInterval)
  recurrenceInterval?: InvoiceRecurrenceInterval;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;
}
