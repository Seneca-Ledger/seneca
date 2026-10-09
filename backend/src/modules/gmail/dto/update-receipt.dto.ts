import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ReceiptStatus } from '../../../entities/receipt.entity';

export class UpdateReceiptDto {
  @ApiProperty({ enum: ReceiptStatus, description: 'Receipt status', required: false })
  @IsEnum(ReceiptStatus)
  @IsOptional()
  status?: ReceiptStatus;

  @ApiProperty({ description: 'Parsed receipt data', required: false })
  @IsObject()
  @IsOptional()
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    category?: string;
    confidence?: number;
  };
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
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Transaction date' })
  @IsString()
  date: string;
}
