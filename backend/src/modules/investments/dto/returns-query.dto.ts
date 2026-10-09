import { IsIn, IsOptional } from 'class-validator';

export const RETURNS_RANGES = ['30d', 'ytd', '1y', '3y', '5y', 'all'] as const;

export type ReturnsRange = (typeof RETURNS_RANGES)[number];

export class ReturnsQueryDto {
  @IsOptional()
  @IsIn(RETURNS_RANGES)
  range?: ReturnsRange;
}
