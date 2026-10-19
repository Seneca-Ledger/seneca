import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ReceiptStatus } from '../../../entities/receipt.entity';

/**
 * The parsed fields a person may correct. Everything else in `parsedData`
 * (where a category came from, validation issues, line items, the e-invoice
 * summary) is the server's, so an unknown key is rejected rather than merged.
 */
export class UpdateReceiptParsedDataDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;
}

export class UpdateReceiptDto {
  @ApiProperty({ enum: ReceiptStatus, description: 'Receipt status', required: false })
  @IsEnum(ReceiptStatus)
  @IsOptional()
  status?: ReceiptStatus;

  @ApiProperty({
    description: 'Parsed receipt data',
    required: false,
    type: UpdateReceiptParsedDataDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateReceiptParsedDataDto)
  @IsOptional()
  parsedData?: UpdateReceiptParsedDataDto;
}

export class ApproveReceiptDto {
  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Transaction currency; the workspace currency when omitted' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Transaction description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Transaction date' })
  @IsString()
  date: string;
}
