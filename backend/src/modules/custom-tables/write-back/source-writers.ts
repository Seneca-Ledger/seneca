import { BadRequestException } from '@nestjs/common';
import { Permission } from '../../../common/enums/permissions.enum';
import { appError } from '../../../common/errors/app-error';
import type {
  UpdateBudgetBody,
  UpdateInvoiceBody,
  UpdatePayableBody,
  UpdateSubscriptionBody,
  UpdateTransactionBody,
} from '../../../contracts';
import type { SourceValue } from '../sources/source.types';

/** What a writer knows about the record it changes. */
export interface WriteContext {
  workspaceId: string;
  userId: string;
  /** The editor's workspace membership, for services that apply privacy rules. */
  memberId: string | null;
  /** Record id: the row's `sourceKey`. */
  sourceKey: string;
  /** The record's cell values as the source reads them right now. */
  current: Record<string, SourceValue>;
  /** Category id by name, preferring the given type; null when there is none. */
  resolveCategory: (name: string, type: 'income' | 'expense') => Promise<string | null>;
  /** Invoice client id by name; null when there is none. */
  resolveClient: (name: string) => Promise<string | null>;
}

/** Something the write created in the app that a restore has to remove again. */
export type WriteMeta = Record<string, unknown>;

export interface SourceWriter {
  /** The permission the app's own endpoint for this record requires. */
  permission: Permission;
  /** The app audits this record's updates only in its controller: the write-back has to. */
  auditEntity?: 'payable' | 'invoice';
  /** Applies one cell to the record. Sends only that field: tax-locked rows refuse any tax field. */
  write: (field: string, value: unknown, ctx: WriteContext) => Promise<WriteMeta | undefined>;
  /** Puts a field back to the value it had before the table's first edit. */
  revert: (
    field: string,
    original: unknown,
    meta: WriteMeta | null,
    ctx: WriteContext,
  ) => Promise<void>;
}

/** The narrow slice of each domain service the writers call; plain mocks in tests. */
export interface WriterServices {
  transactions: {
    update: (
      id: string,
      workspaceId: string,
      userId: string,
      dto: UpdateTransactionBody,
      batchId?: string | null,
      viewerMemberId?: string | null,
    ) => Promise<unknown>;
  };
  subscriptions: {
    update: (
      id: string,
      workspaceId: string,
      userId: string,
      dto: UpdateSubscriptionBody,
    ) => Promise<unknown>;
  };
  payables: {
    findOne: (
      id: string,
      workspaceId: string,
    ) => Promise<{ status: string; paidAmount?: string | number | null }>;
    update: (
      id: string,
      workspaceId: string,
      userId: string,
      dto: UpdatePayableBody,
    ) => Promise<unknown>;
    markAsPaid: (
      id: string,
      workspaceId: string,
      userId: string,
      payload: Record<string, never>,
    ) => Promise<unknown>;
    archive: (id: string, workspaceId: string, userId: string) => Promise<unknown>;
    listPayments: (id: string, workspaceId: string) => Promise<Array<{ id: string }>>;
    removePayment: (id: string, paymentId: string, workspaceId: string) => Promise<unknown>;
  };
  invoices: {
    update: (id: string, workspaceId: string, dto: UpdateInvoiceBody) => Promise<unknown>;
  };
  budgets: {
    update: (
      id: string,
      workspaceId: string,
      userId: string,
      dto: UpdateBudgetBody,
    ) => Promise<unknown>;
  };
  documents: {
    /**
     * A scanned receipt is one transaction shown as a document: its document
     * and receipt carry the category too and must follow the transaction's.
     */
    followTransactionCategory: (transactionId: string, workspaceId: string) => Promise<void>;
  };
}

// ---------------------------------------------------------------- coercion --

const invalid = (field: string) =>
  new BadRequestException(appError('INVALID_CELL_VALUE', { field }));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Text as the app stores it; empty cells become ''. */
const asText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const asRequiredText = (value: unknown, field: string): string => {
  const text = asText(value);
  if (!text) {
    throw invalid(field);
  }
  return text;
};

const asNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (value === null || value === '' || !Number.isFinite(number)) {
    throw invalid(field);
  }
  return number;
};

const asAmount = (value: unknown, field: string): number => {
  const number = asNumber(value, field);
  if (number < 0) {
    throw invalid(field);
  }
  return number;
};

/** A real calendar day as YYYY-MM-DD; null for an empty cell when the field allows it. */
const asDate = (value: unknown, field: string, nullable: boolean): string | null => {
  const text = asText(value);
  if (!text) {
    if (nullable) {
      return null;
    }
    throw invalid(field);
  }
  const day = text.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (
    !DATE_RE.test(day) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  ) {
    throw invalid(field);
  }
  return day;
};

const asCurrency = (value: unknown, field: string): string => {
  const code = asText(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw invalid(field);
  }
  return code;
};

const asOneOf = <T extends string>(value: unknown, allowed: readonly T[], field: string): T => {
  const text = asText(value) as T;
  if (!allowed.includes(text)) {
    throw invalid(field);
  }
  return text;
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return false;
  }
  throw invalid(field);
};

/** Category name → id; an empty cell clears it, an unknown name is refused (never created). */
const categoryIdFor = async (
  value: unknown,
  type: 'income' | 'expense',
  ctx: WriteContext,
): Promise<string | null> => {
  const name = asText(value);
  if (!name) {
    return null;
  }
  const id = await ctx.resolveCategory(name, type);
  if (!id) {
    throw new BadRequestException(appError('CATEGORY_NOT_FOUND'));
  }
  return id;
};

const readOnly = () => new BadRequestException(appError('SOURCE_FIELD_READ_ONLY'));

/** Most fields revert by writing the original back through the same path. */
const revertByWriting =
  (write: SourceWriter['write']): SourceWriter['revert'] =>
  async (field, original, _meta, ctx) => {
    await write(field, original, ctx);
  };

// ------------------------------------------------------------- transactions --

const TRANSACTION_TYPES = ['income', 'expense'] as const;

/**
 * The table shows a signed amount; the app stores a magnitude on the debit
 * (expense) or credit (income) side and derives amount and type from it. The
 * other side is cleared explicitly, or the service would keep a stale value.
 */
const signedAmountBody = (signed: number): UpdateTransactionBody =>
  signed < 0 ? { debit: Math.abs(signed), credit: null } : { credit: signed, debit: null };

const transactionsWriter = (services: WriterServices): SourceWriter => {
  const write: SourceWriter['write'] = async (field, value, ctx) => {
    const dto = await transactionBody(field, value, ctx);
    await services.transactions.update(
      ctx.sourceKey,
      ctx.workspaceId,
      ctx.userId,
      dto,
      null,
      ctx.memberId,
    );
    if (field === 'category') {
      await services.documents.followTransactionCategory(ctx.sourceKey, ctx.workspaceId);
    }
    return undefined;
  };
  return { permission: Permission.TRANSACTION_EDIT, write, revert: revertByWriting(write) };
};

async function transactionBody(
  field: string,
  value: unknown,
  ctx: WriteContext,
): Promise<UpdateTransactionBody> {
  switch (field) {
    case 'date':
      return { transactionDate: asDate(value, field, false) as string };
    case 'counterparty':
      return { counterpartyName: asText(value) };
    case 'purpose':
      return { paymentPurpose: asText(value) };
    case 'amount':
      return signedAmountBody(asNumber(value, field));
    case 'type': {
      const type = asOneOf(value, TRANSACTION_TYPES, field);
      const magnitude = Math.abs(Number(ctx.current.amount ?? 0)) || 0;
      return signedAmountBody(type === 'expense' ? -magnitude : magnitude);
    }
    case 'category': {
      const type = ctx.current.type === 'income' ? 'income' : 'expense';
      return { categoryId: await categoryIdFor(value, type, ctx) };
    }
    case 'currency':
      return { currency: asCurrency(value, field) };
    default:
      throw readOnly();
  }
}

// ------------------------------------------------------------ subscriptions --

const SUBSCRIPTION_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'] as const;
const SUBSCRIPTION_STATUSES = ['detected', 'active', 'paused', 'cancelled'] as const;

const subscriptionsWriter = (services: WriterServices): SourceWriter => {
  const write: SourceWriter['write'] = async (field, value, ctx) => {
    const dto = await subscriptionBody(field, value, ctx);
    await services.subscriptions.update(ctx.sourceKey, ctx.workspaceId, ctx.userId, dto);
    return undefined;
  };
  return { permission: Permission.SUBSCRIPTION_EDIT, write, revert: revertByWriting(write) };
};

async function subscriptionBody(
  field: string,
  value: unknown,
  ctx: WriteContext,
): Promise<UpdateSubscriptionBody> {
  switch (field) {
    case 'vendor':
      return { vendorName: asRequiredText(value, field) };
    case 'amount':
      return { amount: asAmount(value, field) };
    case 'currency':
      return { currency: asCurrency(value, field) };
    case 'frequency':
      return { frequency: asOneOf(value, SUBSCRIPTION_FREQUENCIES, field) };
    case 'status':
      return { status: asOneOf(value, SUBSCRIPTION_STATUSES, field) };
    case 'nextChargeDate':
      return { nextChargeDate: asDate(value, field, true) };
    case 'category':
      return { categoryId: await categoryIdFor(value, 'expense', ctx) };
    default:
      throw readOnly();
  }
}

// ----------------------------------------------------------------- payables --

const PAYABLE_DIRECTIONS = ['payable', 'receivable'] as const;
/** What a person may pick; `partially_paid` follows the payments and is never set by hand. */
const PAYABLE_STATUSES = ['to_pay', 'scheduled', 'paid', 'overdue', 'archived'] as const;
const SETTLED = new Set(['paid', 'partially_paid']);

const payablesWriter = (services: WriterServices): SourceWriter => {
  const write: SourceWriter['write'] = async (field, value, ctx) => {
    if (field === 'status') {
      return writePayableStatus(services, value, ctx);
    }
    await services.payables.update(
      ctx.sourceKey,
      ctx.workspaceId,
      ctx.userId,
      payableBody(field, value),
    );
    return undefined;
  };

  // A payment the table recorded is removed again, then the status put back
  // as it was — with `update`, never another `markAsPaid`, so nothing is paid twice.
  const revert: SourceWriter['revert'] = async (field, original, meta, ctx) => {
    if (field !== 'status') {
      await write(field, original, ctx);
      return;
    }
    const paymentId = typeof meta?.paymentId === 'string' ? meta.paymentId : null;
    if (paymentId) {
      await services.payables.removePayment(ctx.sourceKey, paymentId, ctx.workspaceId);
    }
    const now = await services.payables.findOne(ctx.sourceKey, ctx.workspaceId);
    const target = asText(original);
    if (target && now.status !== target) {
      await services.payables.update(ctx.sourceKey, ctx.workspaceId, ctx.userId, {
        status: target as UpdatePayableBody['status'],
      });
    }
  };

  return {
    permission: Permission.PAYABLE_EDIT,
    auditEntity: 'payable',
    write,
    revert,
  };
};

function payableBody(field: string, value: unknown): UpdatePayableBody {
  switch (field) {
    case 'direction':
      return { direction: asOneOf(value, PAYABLE_DIRECTIONS, field) };
    case 'vendor':
      return { vendor: asRequiredText(value, field).slice(0, 255) };
    case 'amount':
      return { amount: asAmount(value, field) };
    case 'currency':
      return { currency: asCurrency(value, field) };
    case 'dueDate': {
      const day = asDate(value, field, false);
      return { dueDate: day as string };
    }
    case 'isRecurring':
      return { isRecurring: asBoolean(value, field) };
    case 'comment':
      return { comment: asText(value) || null };
    default:
      throw readOnly();
  }
}

async function writePayableStatus(
  services: WriterServices,
  value: unknown,
  ctx: WriteContext,
): Promise<WriteMeta | undefined> {
  if (asText(value) === 'partially_paid') {
    throw new BadRequestException(appError('PAYABLE_STATUS_FROM_PAYMENTS'));
  }
  const target = asOneOf(value, PAYABLE_STATUSES, 'status');
  const payable = await services.payables.findOne(ctx.sourceKey, ctx.workspaceId);
  if (payable.status === target) {
    return undefined;
  }
  const hasPayments = SETTLED.has(payable.status) || Number(payable.paidAmount ?? 0) > 0;
  if (target === 'archived') {
    await services.payables.archive(ctx.sourceKey, ctx.workspaceId, ctx.userId);
    return undefined;
  }
  if (target === 'paid') {
    // A payment for everything outstanding, recorded the way the Payables page
    // does it; its id is kept so a restore removes exactly this payment.
    const before = new Set(
      (await services.payables.listPayments(ctx.sourceKey, ctx.workspaceId)).map(p => p.id),
    );
    await services.payables.markAsPaid(ctx.sourceKey, ctx.workspaceId, ctx.userId, {});
    const created = (await services.payables.listPayments(ctx.sourceKey, ctx.workspaceId)).find(
      payment => !before.has(payment.id),
    );
    return created ? { paymentId: created.id } : undefined;
  }
  if (hasPayments) {
    throw new BadRequestException(appError('PAYABLE_STATUS_FROM_PAYMENTS'));
  }
  await services.payables.update(ctx.sourceKey, ctx.workspaceId, ctx.userId, { status: target });
  return undefined;
}

// ----------------------------------------------------------------- invoices --

const invoicesWriter = (services: WriterServices): SourceWriter => {
  const write: SourceWriter['write'] = async (field, value, ctx) => {
    await services.invoices.update(
      ctx.sourceKey,
      ctx.workspaceId,
      await invoiceBody(field, value, ctx),
    );
    return undefined;
  };
  return {
    permission: Permission.INVOICE_EDIT,
    auditEntity: 'invoice',
    write,
    revert: revertByWriting(write),
  };
};

async function invoiceBody(
  field: string,
  value: unknown,
  ctx: WriteContext,
): Promise<UpdateInvoiceBody> {
  switch (field) {
    case 'client': {
      const id = await ctx.resolveClient(asRequiredText(value, field));
      if (!id) {
        throw new BadRequestException(appError('INVOICE_CLIENT_NOT_FOUND'));
      }
      return { clientId: id };
    }
    case 'issueDate':
      return { issueDate: asDate(value, field, false) as string };
    case 'dueDate':
      return { dueDate: asDate(value, field, false) as string };
    case 'currency':
      return { currency: asCurrency(value, field) };
    case 'notes':
      return { notes: asText(value) || null };
    default:
      throw readOnly();
  }
}

// ------------------------------------------------------------------ budgets --

const budgetsWriter = (services: WriterServices): SourceWriter => {
  const write: SourceWriter['write'] = async (field, value, ctx) => {
    await services.budgets.update(
      ctx.sourceKey,
      ctx.workspaceId,
      ctx.userId,
      budgetBody(field, value),
    );
    return undefined;
  };
  return { permission: Permission.BUDGET_EDIT, write, revert: revertByWriting(write) };
};

function budgetBody(field: string, value: unknown): UpdateBudgetBody {
  switch (field) {
    case 'name':
      return { name: asRequiredText(value, field) };
    case 'limit':
      return { limitAmount: asAmount(value, field) };
    case 'currency':
      return { currency: asCurrency(value, field) };
    default:
      throw readOnly();
  }
}

/** One writer per source kind. */
export const buildSourceWriters = (services: WriterServices): Record<string, SourceWriter> => ({
  transactions: transactionsWriter(services),
  subscriptions: subscriptionsWriter(services),
  payables: payablesWriter(services),
  invoices: invoicesWriter(services),
  budgets: budgetsWriter(services),
});
