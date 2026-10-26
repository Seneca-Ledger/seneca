import type { PendingPayment, SubscriptionFormData } from './useSubscriptionsPage';

const COOKIE_NAME = 'subscription_draft';
// Long enough to close the drawer by mistake and come back, short enough that
// a stale draft does not greet someone the next day.
const MAX_AGE_SECONDS = 300;
// Browsers drop a cookie over 4 KB; payments go first when a draft is too long.
const MAX_COOKIE_LENGTH = 3800;
// Only the subscriptions page reads it, so API requests never carry it.
const COOKIE_ATTRIBUTES = `path=/subscriptions; max-age=${MAX_AGE_SECONDS}; samesite=lax`;

const FREQUENCIES = new Set<SubscriptionFormData['frequency']>([
  'weekly',
  'monthly',
  'quarterly',
  'annual',
]);

const isFrequency = (value: unknown): value is SubscriptionFormData['frequency'] =>
  typeof value === 'string' && FREQUENCIES.has(value as SubscriptionFormData['frequency']);

const readPayment = (value: unknown): PendingPayment | null => {
  if (!value || typeof value !== 'object') return null;
  const { key, date, amount, currency, linked, transactionId } = value as Record<string, unknown>;
  if (
    typeof key !== 'string' ||
    typeof date !== 'string' ||
    typeof amount !== 'number' ||
    typeof currency !== 'string' ||
    typeof linked !== 'boolean' ||
    !(transactionId === null || typeof transactionId === 'string')
  ) {
    return null;
  }
  return { key, date, amount, currency, linked, transactionId };
};

const readForm = (value: unknown): SubscriptionFormData | null => {
  if (!value || typeof value !== 'object') return null;
  const form = value as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof form[key] === 'string' ? (form[key] as string) : null;
  const vendorName = text('vendorName');
  const currency = text('currency');
  const categoryId = text('categoryId');
  const nextChargeDate = text('nextChargeDate');
  const vendorDomain = text('vendorDomain');
  // Drafts saved before budgets existed have no field: none.
  const budgetId = text('budgetId') ?? '';
  const amount = form.amount === '' || typeof form.amount === 'number' ? form.amount : null;
  if (
    vendorName === null ||
    currency === null ||
    categoryId === null ||
    nextChargeDate === null ||
    vendorDomain === null ||
    amount === null ||
    !isFrequency(form.frequency)
  ) {
    return null;
  }
  const payments = Array.isArray(form.payments)
    ? form.payments.flatMap(payment => readPayment(payment) ?? [])
    : [];
  return {
    vendorName,
    amount,
    frequency: form.frequency,
    currency,
    categoryId,
    nextChargeDate,
    vendorDomain,
    budgetId,
    payments,
  };
};

const encode = (workspaceId: string, form: SubscriptionFormData): string =>
  encodeURIComponent(JSON.stringify({ workspaceId, form }));

/** Keeps the add form for five minutes from its last change. */
export function saveSubscriptionDraft(workspaceId: string, form: SubscriptionFormData): void {
  let value = encode(workspaceId, form);
  if (value.length > MAX_COOKIE_LENGTH) value = encode(workspaceId, { ...form, payments: [] });
  if (value.length > MAX_COOKIE_LENGTH) return;
  document.cookie = `${COOKIE_NAME}=${value}; ${COOKIE_ATTRIBUTES}`;
}

/** The add form left in this workspace less than five minutes ago, if any. */
export function readSubscriptionDraft(workspaceId: string): SubscriptionFormData | null {
  const raw = document.cookie
    .split('; ')
    .find(part => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    const { workspaceId: draftWorkspaceId, form } = parsed as Record<string, unknown>;
    return draftWorkspaceId === workspaceId ? readForm(form) : null;
  } catch {
    // A cookie that is not ours, or cut short: no draft.
    return null;
  }
}

export function clearSubscriptionDraft(): void {
  document.cookie = `${COOKIE_NAME}=; path=/subscriptions; max-age=0; samesite=lax`;
}
