import { In, type Repository } from 'typeorm';
import { Payable, PayableDirection } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import type { Receipt } from '../../entities/receipt.entity';
import type { Statement } from '../../entities/statement.entity';
import { documentHref, findScanReceipts } from '../search/document-href';

/** The list each kind of bill lives in: income is Receive, expenses are Pay. */
const LIST: Record<PayableDirection, string> = {
  [PayableDirection.RECEIVABLE]: '/statements/receive',
  [PayableDirection.PAYABLE]: '/statements/pay',
};

/**
 * Where a transaction typed in by hand opens: the bill it settled — a sale
 * marked received, a bill marked paid — in its own list, ringed there through
 * `?focus=payable:<id>` (the list tags its rows `data-attention`). A transaction
 * that settled no bill gets null, and keeps no link.
 */
export async function billHrefsFor(
  payables: Repository<Payable>,
  workspaceId: string,
  transactionIds: string[],
): Promise<(transactionId: string) => string | null> {
  const hrefs = new Map<string, string>();
  const hrefOf = (transactionId: string): string | null => hrefs.get(transactionId) ?? null;
  if (transactionIds.length === 0) {
    return hrefOf;
  }
  const payments = await payables.manager.getRepository(PayablePayment).find({
    select: { payableId: true, transactionId: true },
    where: { workspaceId, transactionId: In(transactionIds) },
  });
  const bills = await payables.find({
    select: { id: true, direction: true, linkedTransactionId: true },
    where: [
      { workspaceId, linkedTransactionId: In(transactionIds) },
      ...(payments.length > 0
        ? [{ workspaceId, id: In(payments.map(payment => payment.payableId)) }]
        : []),
    ],
  });
  const byId = new Map(bills.map(bill => [bill.id, bill]));
  const settled: Array<[string | null, Payable | undefined]> = [
    ...bills.map((bill): [string | null, Payable] => [bill.linkedTransactionId, bill]),
    ...payments.map((payment): [string | null, Payable | undefined] => [
      payment.transactionId,
      byId.get(payment.payableId),
    ]),
  ];
  for (const [transactionId, bill] of settled) {
    if (transactionId && bill && !hrefs.has(transactionId)) {
      const focus = encodeURIComponent(`payable:${bill.id}`);
      hrefs.set(transactionId, `${LIST[bill.direction]}?focus=${focus}`);
    }
  }
  return hrefOf;
}

/** What a recent-transactions row carries for its link. */
export interface RecentRowLink {
  id: string;
  statementId: string | null;
  statementStatus: Statement['status'];
  parsingDetails: Statement['parsingDetails'];
}

/**
 * Each row's link, by position: its document, by the same rule as a click in
 * the Documents list; for one entered by hand the bill it settled; else none.
 */
export async function recentRowHrefs(
  receipts: Repository<Receipt>,
  payables: Repository<Payable>,
  workspaceId: string,
  rows: RecentRowLink[],
): Promise<(index: number) => string | null> {
  const documents = rows.map(row =>
    row.statementId
      ? { id: row.statementId, status: row.statementStatus, parsingDetails: row.parsingDetails }
      : null,
  );
  const handEntered = rows.filter(row => !row.statementId).map(row => row.id);
  const present = documents.filter(document => document !== null);
  const [scanReceipts, billHref] = await Promise.all([
    findScanReceipts(receipts, workspaceId, present),
    billHrefsFor(payables, workspaceId, handEntered),
  ]);
  return index => {
    const document = documents[index];
    return document ? documentHref(document, scanReceipts) : billHref(rows[index].id);
  };
}
