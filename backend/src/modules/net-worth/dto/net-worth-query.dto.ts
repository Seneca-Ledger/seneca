export const NET_WORTH_RANGES = ['30d', '90d', '180d', 'ytd', '1y', '3y', '5y', 'all'] as const;

export type NetWorthRange = (typeof NET_WORTH_RANGES)[number];
