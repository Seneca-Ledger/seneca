import type {
  LedgerAccount,
  LedgerAccountType,
  NormalBalance,
} from '../../../entities/ledger-account.entity';

export class LedgerAccountResponseDto {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: LedgerAccountType;
  normalBalance: NormalBalance;
  currency: string | null;
  isPostable: boolean;
  isSystem: boolean;
  position: number;

  static from(account: LedgerAccount): LedgerAccountResponseDto {
    return {
      id: account.id,
      parentId: account.parentId,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      currency: account.currency,
      isPostable: account.isPostable,
      isSystem: account.isSystem,
      position: account.position,
    };
  }
}
