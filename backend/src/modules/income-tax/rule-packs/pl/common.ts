/** Shared by the Polish business returns on income (PIT-36, PIT-36L). */

export type Treatment = 'deduct' | 'cost';

/**
 * A contribution is either deducted from income or counted as a cost, never
 * both. Deduction is the default because it is how the forms lay them out.
 */
export function treatment(value: unknown): Treatment {
  return value === 'cost' ? 'cost' : 'deduct';
}

export const REVENUE_CATEGORIES = ['Sales', 'Services'];

export const COST_CATEGORIES = [
  'Advertising',
  'Equipment',
  'Fees and charges',
  'Maintenance and repairs',
  'Materials',
  'Office supplies',
  'Payroll',
  'Professional services',
  'Rent',
  'Travel',
  'Utilities',
];
