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
  Min,
  ValidateNested,
} from 'class-validator';

export class AddPayablePaymentDto {
  /** How much of the bill this settles, in the bill's currency. */
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  /** What the processor kept: the bank received `amount - feeAmount`. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  /** Day of the payment; today when omitted. */
  @IsOptional()
  @IsDateString()
  paidOn?: string;

  /** An existing transaction this payment came from. */
  @IsOptional()
  @IsUUID()
  linkedTransactionId?: string;

  /** Paid in cash: record the payment as a new transaction of this wallet. */
  @IsOptional()
  @IsUUID()
  payFromWalletId?: string;

  /** Category of the cash payment's transaction. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class TransactionAllocationDto {
  @IsUUID()
  payableId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeAmount?: number;
}

/** One transaction spread over several bills. */
export class AllocateTransactionDto {
  @IsUUID()
  transactionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TransactionAllocationDto)
  allocations: TransactionAllocationDto[];

  @IsOptional()
  @IsDateString()
  paidOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
