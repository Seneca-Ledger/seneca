import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from '../../../entities/transaction.entity';

export class UpdateTransactionDto {
  @IsDateString()
  @IsOptional()
  transactionDate?: Date;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  counterpartyName?: string;

  @IsString()
  @IsOptional()
  counterpartyBin?: string;

  @IsString()
  @IsOptional()
  counterpartyAccount?: string;

  @IsString()
  @IsOptional()
  counterpartyBank?: string;

  @IsNumber()
  @IsOptional()
  debit?: number;

  @IsNumber()
  @IsOptional()
  credit?: number;

  @IsNumber()
  @IsOptional()
  amountForeign?: number;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  paymentPurpose?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  @IsOptional()
  walletId?: string;

  /**
   * Which member of the household the row belongs to. `null` hands it back to
   * the household as shared, which is why it is nullable rather than just
   * optional: leaving it out means "do not touch", sending null means "shared".
   */
  @IsUUID()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  ownerMemberId?: string | null;

  @IsString()
  @IsOptional()
  article?: string;

  @IsString()
  @IsOptional()
  activityType?: string;

  @IsEnum(TransactionType)
  @IsOptional()
  transactionType?: TransactionType;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  /**
   * Hides what the row was from the rest of the household. Only its owner may
   * set it, and only on a row that is theirs.
   */
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
