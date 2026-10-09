import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Building2,
  Car,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Handshake,
  Heart,
  Home,
  Landmark,
  Laptop,
  type LucideIcon,
  Megaphone,
  MoreHorizontal,
  Package,
  Percent,
  Plane,
  Printer,
  ReceiptText,
  Scale,
  Shield,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from '@/app/components/icons';
import { categoryIconFor } from './category-icon-choices';
import { resolveCategoryIconUrl } from './category-icon-url';
import { resolveCategorySlug } from './statement-categories';

/** The backend substitutes this when a category row has no colour; treat it as "unset". */
export const BACKEND_FALLBACK_COLOR = '#898781';
export const NEUTRAL_CATEGORY_COLOR = '#64748b';

export interface CategoryVisual {
  Icon: LucideIcon;
  color: string;
}

/**
 * Presentation defaults for the system categories, keyed by the slugs from
 * `systemCategories.content.ts`. Categories are seeded without colour or icon,
 * so without this table every dashboard badge is a grey tag. Values stored on
 * the category row always win (see `resolveCategoryVisual`).
 */
export const CATEGORY_DEFAULTS: Record<string, CategoryVisual> = {
  // income
  sales: { Icon: TrendingUp, color: '#10b981' },
  kaspiSales: { Icon: Store, color: '#10b981' },
  income: { Icon: CircleDollarSign, color: '#10b981' },
  otherIncome: { Icon: CircleDollarSign, color: '#14b8a6' },
  interestIncome: { Icon: Percent, color: '#14b8a6' },
  // services & people
  services: { Icon: Handshake, color: '#6366f1' },
  professionalServices: { Icon: Briefcase, color: '#6366f1' },
  servicePayments: { Icon: ReceiptText, color: '#6366f1' },
  itServices: { Icon: Cloud, color: '#3b82f6' },
  payroll: { Icon: Users, color: '#8b5cf6' },
  employeeSalaries: { Icon: Users, color: '#8b5cf6' },
  benefits: { Icon: Heart, color: '#f43f5e' },
  // marketing
  advertising: { Icon: Megaphone, color: '#ec4899' },
  marketing: { Icon: Megaphone, color: '#ec4899' },
  // transport & logistics
  vehicleExpenses: { Icon: Car, color: '#0ea5e9' },
  travel: { Icon: Plane, color: '#0284c7' },
  logistics: { Icon: Truck, color: '#f97316' },
  // goods & equipment
  equipment: { Icon: Laptop, color: '#64748b' },
  maintenance: { Icon: Wrench, color: '#f59e0b' },
  materials: { Icon: Package, color: '#a16207' },
  inventoryPurchases: { Icon: ShoppingBag, color: '#d946ef' },
  officeSupplies: { Icon: Printer, color: '#78716c' },
  // premises
  homeOffice: { Icon: Home, color: '#8b5cf6' },
  rent: { Icon: Building2, color: '#7c3aed' },
  utilities: { Icon: Zap, color: '#eab308' },
  insurance: { Icon: Shield, color: '#0891b2' },
  // money & fees
  interest: { Icon: Percent, color: '#0ea5e9' },
  feesAndCharges: { Icon: ReceiptText, color: '#ef4444' },
  bankFees: { Icon: Landmark, color: '#ef4444' },
  kaspiFees: { Icon: ReceiptText, color: '#dc2626' },
  kaspiRedPayments: { Icon: CreditCard, color: '#dc2626' },
  taxes: { Icon: Scale, color: '#b91c1c' },
  loans: { Icon: Banknote, color: '#9333ea' },
  internalTransfers: { Icon: ArrowLeftRight, color: '#94a3b8' },
  // misc
  meals: { Icon: Utensils, color: '#f59e0b' },
  otherExpenses: { Icon: Wallet, color: '#64748b' },
  uncategorized: { Icon: Tag, color: '#94a3b8' },
};

export interface CategoryVisualInput {
  name?: string | null;
  color?: string | null;
  /** Stored icon value: an uploaded-file URL or a picked `mdi:*` icon. */
  icon?: string | null;
  /** The synthetic "Other" rollup bucket. */
  isOther?: boolean;
}

export interface ResolvedCategoryVisual {
  color: string;
  iconUrl: string | null;
  Icon: LucideIcon;
}

function hasStoredColor(color: string | null | undefined): color is string {
  return Boolean(color) && color !== BACKEND_FALLBACK_COLOR;
}

function defaultFor(name: string | null | undefined): CategoryVisual | null {
  const slug = resolveCategorySlug(name);
  return slug ? (CATEGORY_DEFAULTS[slug] ?? null) : null;
}

/** Colour for a category: the stored one, else the default by name, else neutral. */
export function categoryColorFor(name: string | null | undefined, color?: string | null): string {
  if (hasStoredColor(color)) {
    return color;
  }
  return defaultFor(name)?.color ?? NEUTRAL_CATEGORY_COLOR;
}

export function resolveCategoryVisual(input: CategoryVisualInput): ResolvedCategoryVisual {
  if (input.isOther) {
    return { color: NEUTRAL_CATEGORY_COLOR, iconUrl: null, Icon: MoreHorizontal };
  }
  const iconUrl = resolveCategoryIconUrl(input.icon);
  return {
    color: categoryColorFor(input.name, input.color),
    iconUrl,
    // An icon picked in the category editor wins over the default by name.
    Icon: input.icon?.startsWith('mdi:')
      ? categoryIconFor(input.icon)
      : (defaultFor(input.name)?.Icon ?? Tag),
  };
}
