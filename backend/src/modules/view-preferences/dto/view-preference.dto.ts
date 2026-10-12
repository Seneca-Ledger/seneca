import { IsIn } from 'class-validator';

/**
 * The pages that remember themselves. A closed list, so a typo in a client
 * cannot quietly fill the table with scopes nothing ever reads back.
 */
export const VIEW_SCOPES = [
  'transactions',
  'review',
  'reports',
  'dashboard',
  'onboarding',
] as const;

export class ViewScopeParam {
  @IsIn(VIEW_SCOPES)
  scope: (typeof VIEW_SCOPES)[number];
}
