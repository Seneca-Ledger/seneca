import { describe, expect, it } from 'vitest';

import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';

describe('resolveReceiptMerchantLabel', () => {
  it('uses parsed vendor when it is a short brand-like value', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'GitHub',
      sender: 'GitHub <noreply@github.com>',
      subject: '[GitHub] Receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('prefers sender brand when vendor is long descriptive sentence', () => {
    const label = resolveReceiptMerchantLabel({
      vendor:
        'We received payment for your sponsorship. Thanks for your support of Open Source Software!',
      sender: 'GitHub <noreply@github.com>',
      subject: '[GitHub] Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('strips support suffix from sender display name', () => {
    const label = resolveReceiptMerchantLabel({
      sender: 'Bitwage Support <support@bitwage.com>',
    });

    expect(label).toBe('Bitwage');
  });

  it('extracts brand from sender domain when sender has no display name', () => {
    const label = resolveReceiptMerchantLabel({
      sender: '<billing@lidl.com>',
    });

    expect(label).toBe('Lidl');
  });

  it('does not return generic page marker text', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'Page 1 of 1',
      sender: 'GitHub <noreply@github.com>',
      subject: 'Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('rejects date-like vendor values and falls back to sender', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'Date2026-02-16 10:57AM PST',
      sender: 'GitHub <noreply@github.com>',
      subject: 'Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('rejects timestamp vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: '2026-02-16 10:57',
      sender: 'Spotify <no-reply@spotify.com>',
    });

    expect(label).toBe('Spotify');
  });

  it('rejects amount-like vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: '$49.99',
      sender: 'Adobe <mail@adobe.com>',
    });

    expect(label).toBe('Adobe');
  });

  it('rejects email-like vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'noreply@github.com',
      sender: 'GitHub <noreply@github.com>',
    });

    expect(label).toBe('GitHub');
  });
});
