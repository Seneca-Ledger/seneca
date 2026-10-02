import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const NET_WORTH_RANGES = [
  '1d',
  '30d',
  '90d',
  '180d',
  'ytd',
  '1y',
  '3y',
  '5y',
  'all',
] as const;

export type NetWorthRange = (typeof NET_WORTH_RANGES)[number];

export class NetWorthQueryDto {
  @IsOptional()
  @IsIn(NET_WORTH_RANGES)
  range?: NetWorthRange;

  /**
   * A window of the user's own choosing. With `from` set the preset is
   * ignored: people with ten years of history want the two years around a job
   * change, not whichever preset happens to be closest.
   */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
