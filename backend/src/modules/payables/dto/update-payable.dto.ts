import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { CreatePayableDto } from './create-payable.dto';

export class UpdatePayableDto extends PartialType(
  OmitType(CreatePayableDto, ['linkedTransactionId', 'comment', 'statementId'] as const),
) {
  @IsOptional()
  @IsUUID()
  linkedTransactionId?: string | null;

  @IsOptional()
  @IsString()
  comment?: string | null;

  @IsOptional()
  @IsUUID()
  statementId?: string | null;
}
