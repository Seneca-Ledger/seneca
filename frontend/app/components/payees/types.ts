import type { PayeeRef } from '@/app/lib/contracts';

export type { Payee, PayeeMode, PayeeRef, PayeesPage } from '@/app/lib/contracts';

/** Either an existing payee, or a name to find or create one by. */
export type PayeeChoice = { payeeId: string } | { name: string };

export type TransactionPayeeResult = {
  id: string;
  payee: PayeeRef;
  categoryId: string | null;
  categorySource: string | null;
};
