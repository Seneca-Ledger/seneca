import type categoryIcons from '@/app/components/categories/categoryIcons.content';
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

export type CategoryIconLabelKey = keyof typeof categoryIcons.content;

/**
 * Icons offered in the category editor. `value` is what the category row stores
 * (legacy `mdi:*` names), so existing categories keep their choice.
 */
export const CATEGORY_ICON_CHOICES: ReadonlyArray<{
  value: string;
  /** What the icon stands for (`categoryIcons` dictionary), as its tooltip and accessible name. */
  labelKey: CategoryIconLabelKey;
  Icon: LucideIcon;
}> = [
  { value: 'mdi:home', labelKey: 'home', Icon: Home },
  { value: 'mdi:food', labelKey: 'food', Icon: Utensils },
  { value: 'mdi:coffee', labelKey: 'coffee', Icon: Coffee },
  { value: 'mdi:cart', labelKey: 'groceries', Icon: ShoppingCart },
  { value: 'mdi:shopping', labelKey: 'shopping', Icon: ShoppingBag },
  { value: 'mdi:car', labelKey: 'car', Icon: Car },
  { value: 'mdi:gas-station', labelKey: 'fuel', Icon: Fuel },
  { value: 'mdi:airplane', labelKey: 'travel', Icon: Plane },
  { value: 'mdi:medical-bag', labelKey: 'health', Icon: Stethoscope },
  { value: 'mdi:dumbbell', labelKey: 'fitness', Icon: Dumbbell },
  { value: 'mdi:school', labelKey: 'education', Icon: GraduationCap },
  { value: 'mdi:book', labelKey: 'books', Icon: BookOpen },
  { value: 'mdi:gift', labelKey: 'gifts', Icon: Gift },
  { value: 'mdi:gamepad-variant', labelKey: 'games', Icon: Gamepad2 },
  { value: 'mdi:music', labelKey: 'music', Icon: Music },
  { value: 'mdi:paw', labelKey: 'pets', Icon: PawPrint },
  { value: 'mdi:monitor', labelKey: 'electronics', Icon: Monitor },
  { value: 'mdi:cloud', labelKey: 'cloudServices', Icon: Cloud },
  { value: 'mdi:autorenew', labelKey: 'subscriptions', Icon: Repeat },
  { value: 'mdi:phone', labelKey: 'phone', Icon: Smartphone },
  { value: 'mdi:lightning-bolt', labelKey: 'utilities', Icon: Zap },
  { value: 'mdi:wrench', labelKey: 'repairs', Icon: Wrench },
  { value: 'mdi:shield-check', labelKey: 'insurance', Icon: ShieldCheck },
  { value: 'mdi:receipt', labelKey: 'bills', Icon: ReceiptText },
  { value: 'mdi:wallet', labelKey: 'wallet', Icon: Wallet },
  { value: 'mdi:cash', labelKey: 'cash', Icon: Banknote },
  { value: 'mdi:bank', labelKey: 'bank', Icon: Landmark },
  { value: 'mdi:credit-card', labelKey: 'card', Icon: CreditCard },
  { value: 'mdi:piggy-bank', labelKey: 'savings', Icon: PiggyBank },
  { value: 'mdi:chart-line', labelKey: 'investments', Icon: TrendingUp },
  { value: 'mdi:briefcase', labelKey: 'work', Icon: Briefcase },
  { value: 'mdi:heart', labelKey: 'charity', Icon: Heart },
  { value: 'mdi:tag', labelKey: 'other', Icon: Tag },
];

const ICON_BY_VALUE = new Map(CATEGORY_ICON_CHOICES.map(choice => [choice.value, choice.Icon]));

/** Icon for a stored `mdi:*` value; unknown values fall back to a tag. */
export function categoryIconFor(value?: string | null): LucideIcon {
  return (value && ICON_BY_VALUE.get(value)) || Tag;
}
