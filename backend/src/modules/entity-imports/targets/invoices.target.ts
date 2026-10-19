import { IsNull } from 'typeorm';
import { Client } from '../../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../../entities/invoice.entity';
import { InvoiceLineItem } from '../../../entities/invoice-line-item.entity';
import {
  nameKey,
  normalizeCurrencyCode,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

const addDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Clients are matched by name and created when missing. An invoice number
 * already in the workspace is skipped; otherwise the row becomes a draft
 * invoice with a single line item for the total.
 */
export class InvoicesTarget implements ImportTarget {
  readonly kind = 'invoices' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const invoiceRepo = ctx.manager.getRepository(Invoice);
    const clientRepo = ctx.manager.getRepository(Client);
    const [existingInvoices, clients] = await Promise.all([
      invoiceRepo.find({ where: { workspaceId: ctx.workspaceId }, select: ['invoiceNumber'] }),
      clientRepo.find({ where: { workspaceId: ctx.workspaceId, deletedAt: IsNull() } }),
    ]);
    const numbers = new Set(
      existingInvoices.map(item => item.invoiceNumber?.trim().toLowerCase()).filter(Boolean),
    );
    const clientByName = new Map(clients.map(client => [nameKey(client.name), client]));
    const results: RowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const clientName = ctx.cell(row, 'client').trim();
      const issueDate = parseImportDate(ctx.cell(row, 'issueDate'));
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'amount'));
      if (!clientName) {
        results.push({ index, status: 'error', reason: 'client' });
        continue;
      }
      if (!issueDate) {
        results.push({ index, status: 'error', reason: 'issueDate' });
        continue;
      }
      if (value === null || value <= 0) {
        results.push({ index, status: 'error', reason: 'amount' });
        continue;
      }
      const invoiceNumber = ctx.cell(row, 'invoiceNumber').trim() || null;
      const numberKey = invoiceNumber?.toLowerCase();
      if (numberKey && numbers.has(numberKey)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      if (numberKey) {
        numbers.add(numberKey);
      }
      if (dryRun) {
        results.push({ index, status: 'created' });
        continue;
      }
      const currency =
        normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency;
      let client = clientByName.get(nameKey(clientName));
      if (!client) {
        client = await clientRepo.save(
          clientRepo.create({ workspaceId: ctx.workspaceId, name: clientName, currency }),
        );
        clientByName.set(nameKey(clientName), client);
        ctx.created.push({ kind: 'client', id: client.id });
      }
      const dueDate = parseImportDate(ctx.cell(row, 'dueDate')) ?? addDays(issueDate, 14);
      const invoice = await invoiceRepo.save(
        invoiceRepo.create({
          workspaceId: ctx.workspaceId,
          clientId: client.id,
          invoiceNumber,
          status: InvoiceStatus.DRAFT,
          issueDate,
          dueDate,
          currency,
          subtotal: value,
          taxTotal: 0,
          total: value,
          notes: ctx.cell(row, 'notes').trim() || null,
        }),
      );
      await ctx.manager.getRepository(InvoiceLineItem).insert({
        invoiceId: invoice.id,
        description: ctx.cell(row, 'notes').trim() || `Invoice ${invoiceNumber ?? ''}`.trim(),
        quantity: 1,
        unitPrice: value,
      });
      ctx.created.push({ kind: 'invoice', id: invoice.id });
      results.push({ index, status: 'created', id: invoice.id });
    }
    return results;
  }
}
