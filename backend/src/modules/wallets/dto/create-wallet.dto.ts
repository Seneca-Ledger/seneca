import { IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  initialBalance?: number;

  /**
   * Whose account this is in the household; `null` means shared. Transactions
   * imported into it start on the same person.
   */
  @IsUUID()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  ownerMemberId?: string | null;
}
