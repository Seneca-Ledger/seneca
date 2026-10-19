import type { LucideIcon } from '@/app/components/icons';
import {
  Banknote,
  BookOpen,
  Briefcase,
  Car,
  Cloud,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  Monitor,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  ReceiptText,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from './category-line-icons';

/**
 * Icons offered in the category editor. `value` is what the category row stores
 * (legacy `mdi:*` names), so existing categories keep their choice.
 */
export const CATEGORY_ICON_CHOICES: ReadonlyArray<{
  value: string;
  /** What the icon stands for, as its tooltip and accessible name. */
  label: string;
  Icon: LucideIcon;
}> = [
  { value: 'mdi:home', label: 'Home', Icon: Home },
  { value: 'mdi:food', label: 'Food', Icon: Utensils },
  { value: 'mdi:coffee', label: 'Coffee', Icon: Coffee },
  { value: 'mdi:cart', label: 'Groceries', Icon: ShoppingCart },
  { value: 'mdi:shopping', label: 'Shopping', Icon: ShoppingBag },
  { value: 'mdi:car', label: 'Car', Icon: Car },
  { value: 'mdi:gas-station', label: 'Fuel', Icon: Fuel },
  { value: 'mdi:airplane', label: 'Travel', Icon: Plane },
  { value: 'mdi:medical-bag', label: 'Health', Icon: Stethoscope },
  { value: 'mdi:dumbbell', label: 'Fitness', Icon: Dumbbell },
  { value: 'mdi:school', label: 'Education', Icon: GraduationCap },
  { value: 'mdi:book', label: 'Books', Icon: BookOpen },
  { value: 'mdi:gift', label: 'Gifts', Icon: Gift },
  { value: 'mdi:gamepad-variant', label: 'Games', Icon: Gamepad2 },
  { value: 'mdi:music', label: 'Music', Icon: Music },
  { value: 'mdi:paw', label: 'Pets', Icon: PawPrint },
  { value: 'mdi:monitor', label: 'Electronics', Icon: Monitor },
  { value: 'mdi:cloud', label: 'Cloud services', Icon: Cloud },
  { value: 'mdi:autorenew', label: 'Subscriptions', Icon: Repeat },
  { value: 'mdi:phone', label: 'Phone', Icon: Smartphone },
  { value: 'mdi:lightning-bolt', label: 'Utilities', Icon: Zap },
  { value: 'mdi:wrench', label: 'Repairs', Icon: Wrench },
  { value: 'mdi:shield-check', label: 'Insurance', Icon: ShieldCheck },
  { value: 'mdi:receipt', label: 'Bills', Icon: ReceiptText },
  { value: 'mdi:wallet', label: 'Wallet', Icon: Wallet },
  { value: 'mdi:cash', label: 'Cash', Icon: Banknote },
  { value: 'mdi:bank', label: 'Bank', Icon: Landmark },
  { value: 'mdi:credit-card', label: 'Card', Icon: CreditCard },
  { value: 'mdi:piggy-bank', label: 'Savings', Icon: PiggyBank },
  { value: 'mdi:chart-line', label: 'Investments', Icon: TrendingUp },
  { value: 'mdi:briefcase', label: 'Work', Icon: Briefcase },
  { value: 'mdi:heart', label: 'Charity', Icon: Heart },
  { value: 'mdi:tag', label: 'Other', Icon: Tag },
];

const ICON_BY_VALUE = new Map(CATEGORY_ICON_CHOICES.map(choice => [choice.value, choice.Icon]));

/** Icon for a stored `mdi:*` value; unknown values fall back to a tag. */
export function categoryIconFor(value?: string | null): LucideIcon {
  return (value && ICON_BY_VALUE.get(value)) || Tag;
}
