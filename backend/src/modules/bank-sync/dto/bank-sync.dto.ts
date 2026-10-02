import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ConnectWithTokenDto {
  /** Which provider the token belongs to, e.g. `simplefin`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider: string;

  /** The one-time token the provider shows after "new connection". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  setupToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class CreateRedirectConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider: string;

  /** The application credentials the user holds with the provider. */
  @IsObject()
  secrets: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class BeginLinkDto {
  /** The bank, named as the provider names it. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  institution: string;

  @IsString()
  @Length(2, 2)
  country: string;

  /** Where the provider sends the user back; must be a page of this install. */
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  redirectUrl: string;

  /**
   * The consent ceiling the bank advertises. Passing it through is what buys a
   * consent longer than the 90 days most banks default to.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxConsentValiditySeconds?: number;
}

export class CompleteLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  state: string;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;
}

export class UpdateBankSyncAccountDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** The wallet the pulled rows land in; null detaches the feed. */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  walletId?: string | null;
}

/** Moves a wallet's feed to another provider, keeping its history. */
export class SwitchFeedDto {
  @IsUUID()
  walletId: string;

  @IsUUID()
  toConnectionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  toAccountId: string;
}

export class ListInstitutionsQueryDto {
  @IsString()
  @Length(2, 2)
  country: string;
}

export class SyncScopeDto {
  @IsOptional()
  @IsIn(['all', 'connection'])
  scope?: 'all' | 'connection';
}
