/** Mirrors the backend `PayeeView`. */
export type PayeeMode = 'auto' | 'always' | 'never';

export type PayeeRef = { id: string; name: string };

export type Payee = PayeeRef & {
  mode: PayeeMode;
  /** The pinned category, when `mode` is `always`. */
  category: PayeeRef | null;
  /** What a new row of this payee would be filed as now, and why. */
  defaultCategory: (PayeeRef & { source: string }) | null;
  /** Seat and VAT number: what makes a purchase from this payee reverse-charged. */
  countryCode: string | null;
  vatId: string | null;
  /** What the EU's VIES said about `vatId`; null when not asked or it could not answer. */
  vatIdStatus?: 'valid' | 'invalid' | null;
  /** The name the number is registered to, when VIES gave one. */
  vatIdName?: string | null;
  vatIdCheckedAt?: string | null;
  /** Goods or services: where a cross-border reverse charge goes on the German VAT return. */
  supplyType?: 'goods' | 'services' | null;
  transactionCount: number;
  lastSeen: string | null;
};

export type PayeesPage = { data: Payee[]; total: number; page: number; limit: number };

/** Either an existing payee, or a name to find or create one by. */
export type PayeeChoice = { payeeId: string } | { name: string };

export type TransactionPayeeResult = {
  id: string;
  payee: PayeeRef;
  categoryId: string | null;
  categorySource: string | null;
};
