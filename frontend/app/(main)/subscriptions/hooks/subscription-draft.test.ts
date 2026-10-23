import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSubscriptionDraft,
  readSubscriptionDraft,
  saveSubscriptionDraft,
} from './subscription-draft';
import type { SubscriptionFormData } from './useSubscriptionsPage';

const WORKSPACE = 'ws-1';
const form: SubscriptionFormData = {
  vendorName: 'ACME Music',
  amount: 9.99,
  frequency: 'monthly',
  currency: 'USD',
  categoryId: '',
  nextChargeDate: '2026-11-21',
  vendorDomain: '',
  budgetId: 'budget-1',
  payments: [
    {
      key: 'tx-1',
      date: '2026-10-21',
      amount: 9.99,
      currency: 'USD',
      linked: true,
      transactionId: 'tx-1',
    },
  ],
};

describe('subscription draft cookie', () => {
  beforeEach(() => {
    // The cookie is scoped to the subscriptions page.
    window.history.pushState({}, '', '/subscriptions');
  });
  afterEach(() => {
    clearSubscriptionDraft();
  });

  it('brings the add form back in the same workspace', () => {
    saveSubscriptionDraft(WORKSPACE, form);

    expect(readSubscriptionDraft(WORKSPACE)).toEqual(form);
  });

  it('lives five minutes and stays off other paths', () => {
    let written = '';
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      set: (value: string) => {
        written = value;
      },
      get: () => '',
    });
    try {
      saveSubscriptionDraft(WORKSPACE, form);
    } finally {
      if (descriptor) Object.defineProperty(document, 'cookie', descriptor);
      Reflect.deleteProperty(document, 'cookie');
    }

    expect(written).toContain('max-age=300');
    expect(written).toContain('path=/subscriptions');
  });

  it('keeps one workspace draft out of another', () => {
    saveSubscriptionDraft(WORKSPACE, form);

    expect(readSubscriptionDraft('ws-2')).toBeNull();
  });

  it('is gone once cleared', () => {
    saveSubscriptionDraft(WORKSPACE, form);
    clearSubscriptionDraft();

    expect(readSubscriptionDraft(WORKSPACE)).toBeNull();
  });

  it('drops the payments rather than the whole draft when it is too long', () => {
    const payments = Array.from({ length: 40 }, (_, index) => ({
      ...form.payments[0],
      key: `tx-${index}`,
      transactionId: `tx-${index}`,
    }));
    saveSubscriptionDraft(WORKSPACE, { ...form, payments });

    expect(readSubscriptionDraft(WORKSPACE)).toEqual({ ...form, payments: [] });
  });

  it('ignores a cookie that is not a draft', () => {
    document.cookie = 'subscription_draft=not-json; path=/subscriptions';

    expect(readSubscriptionDraft(WORKSPACE)).toBeNull();
  });
});
