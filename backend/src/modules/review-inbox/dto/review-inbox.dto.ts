import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum ReviewInboxKind {
  TRANSACTION = 'transaction',
  RECEIPT = 'receipt',
  DUPLICATE = 'duplicate',
  SUBSCRIPTION = 'subscription',
}

export class ReviewInboxQueryDto {
  @IsOptional()
  @IsEnum(ReviewInboxKind)
  kind?: ReviewInboxKind;

  /**
   * `me` keeps someone else's rows out of the queue: mine plus everything the
   * household has not handed to anyone. Anything else is the whole workspace.
   * Receipts and detected subscriptions belong to no one, so they ignore it.
   */
  @IsOptional()
  @IsIn(['me', 'anyone'])
  reviewer?: 'me' | 'anyone';

  /** Both bounds are inclusive calendar dates; together they make a "vacation mode" selection. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ApproveTransactionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids: string[];

  /** Omitted: keep whatever category the row has and only mark it reviewed. */
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export enum DuplicateDecision {
  /** It is a duplicate: leave it flagged, stop asking. */
  CONFIRM = 'confirm',
  /** It is a real transaction: restore it. */
  KEEP = 'keep',
}

export class ResolveDuplicateDto {
  @IsEnum(DuplicateDecision)
  decision: DuplicateDecision;
}
