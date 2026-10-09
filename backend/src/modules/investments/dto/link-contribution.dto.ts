import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const INVESTMENT_LINK_ROLES = ['contribution', 'withdrawal', 'income'] as const;

export type InvestmentLinkRole = (typeof INVESTMENT_LINK_ROLES)[number];

export class LinkContributionDto {
  @IsUUID()
  transactionId: string;

  @IsUUID()
  accountId: string;

  /**
   * What the row is to the account. An expense can only be a contribution;
   * an income row has to say whether it is money taken back out or a
   * dividend the account paid.
   */
  @IsOptional()
  @IsIn(INVESTMENT_LINK_ROLES)
  role?: InvestmentLinkRole;
}
