import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { PayableStatus } from '../../entities/payable.entity';

export interface AgeingBuckets {
  /** Issued but not due yet. */
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  /** How many invoices the row counts. */
  count: number;
}

export interface AgeingRow extends AgeingBuckets {
  clientId: string;
  clientName: string;
  currency: string;
  /** The oldest unpaid invoice's age in days; negative when nothing is due yet. */
  oldestDays: number;
}

export interface AgeingReport {
  rows: AgeingRow[];
  /** One line per currency, because an amount is not comparable across them. */
  totals: Array<AgeingBuckets & { currency: string }>;
}

const EMPTY: AgeingBuckets = {
  current: 0,
  days1to30: 0,
  days31to60: 0,
  days61to90: 0,
  days90plus: 0,
  total: 0,
  count: 0,
};

/**
 * Who owes what, and for how long.
 *
 * Grouped by client **and currency**: summing a EUR invoice with a KZT one
 * would produce a number that means nothing, and converting them here would
 * hide which rate was used. The report says both.
 */
@Injectable()
export class InvoiceAgeingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async report(workspaceId: string, asOf: Date = new Date()): Promise<AgeingReport> {
    const today = asOf.toISOString().slice(0, 10);
    const rows: Array<{
      client_id: string;
      client_name: string;
      currency: string;
      current: string;
      d1_30: string;
      d31_60: string;
      d61_90: string;
      d90: string;
      total: string;
      invoices: string;
      oldest_days: string;
    }> = await this.invoiceRepository.query(
      `WITH open_invoices AS (
         SELECT i."client_id",
                c."name"     AS client_name,
                i."currency",
                i."total"::numeric AS amount,
                ($1::date - i."due_date") AS days_overdue
           FROM "invoices" i
           JOIN "clients" c ON c."id" = i."client_id"
           LEFT JOIN "payables" p ON p."id" = i."payable_id"
          WHERE i."workspace_id" = $2
            AND i."deleted_at" IS NULL
            AND i."status" = $3
            AND i."invoice_number" IS NOT NULL
            AND (p."id" IS NULL OR p."status" NOT IN ($4, $5))
       )
       SELECT "client_id",
              client_name,
              "currency",
              COALESCE(SUM(amount) FILTER (WHERE days_overdue <= 0), 0)                      AS current,
              COALESCE(SUM(amount) FILTER (WHERE days_overdue BETWEEN 1 AND 30), 0)          AS d1_30,
              COALESCE(SUM(amount) FILTER (WHERE days_overdue BETWEEN 31 AND 60), 0)         AS d31_60,
              COALESCE(SUM(amount) FILTER (WHERE days_overdue BETWEEN 61 AND 90), 0)         AS d61_90,
              COALESCE(SUM(amount) FILTER (WHERE days_overdue > 90), 0)                      AS d90,
              COALESCE(SUM(amount), 0)                                                       AS total,
              COUNT(*)                                                                       AS invoices,
              MAX(days_overdue)                                                              AS oldest_days
         FROM open_invoices
        GROUP BY "client_id", client_name, "currency"
        ORDER BY total DESC, client_name ASC`,
      [today, workspaceId, InvoiceStatus.SENT, PayableStatus.PAID, PayableStatus.ARCHIVED],
    );

    const report: AgeingRow[] = rows.map(row => ({
      clientId: row.client_id,
      clientName: row.client_name,
      currency: row.currency,
      current: Number(row.current),
      days1to30: Number(row.d1_30),
      days31to60: Number(row.d31_60),
      days61to90: Number(row.d61_90),
      days90plus: Number(row.d90),
      total: Number(row.total),
      count: Number(row.invoices),
      oldestDays: Number(row.oldest_days),
    }));

    const byCurrency = new Map<string, AgeingBuckets & { currency: string }>();
    for (const row of report) {
      const bucket = byCurrency.get(row.currency) ?? { ...EMPTY, currency: row.currency };
      bucket.current += row.current;
      bucket.days1to30 += row.days1to30;
      bucket.days31to60 += row.days31to60;
      bucket.days61to90 += row.days61to90;
      bucket.days90plus += row.days90plus;
      bucket.total += row.total;
      bucket.count += row.count;
      byCurrency.set(row.currency, bucket);
    }

    return { rows: report, totals: [...byCurrency.values()] };
  }

  /**
   * What a client owes past its due dates, per currency — the base a late fee
   * is charged on.
   */
  async overdueByCurrency(
    workspaceId: string,
    clientId: string,
    asOf: Date = new Date(),
  ): Promise<Array<{ currency: string; amount: number }>> {
    const { rows } = await this.report(workspaceId, asOf);
    return rows
      .filter(row => row.clientId === clientId)
      .map(row => ({
        currency: row.currency,
        amount:
          Math.round((row.days1to30 + row.days31to60 + row.days61to90 + row.days90plus) * 100) /
          100,
      }))
      .filter(row => row.amount > 0);
  }
}
