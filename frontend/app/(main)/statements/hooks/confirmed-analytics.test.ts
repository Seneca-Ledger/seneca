import { describe, expect, it } from 'vitest';
import type { GmailReceipt, Transaction } from '../types/statement-types';
import { keepConfirmed } from './confirmed-analytics';

const transaction = (id: string, isVerified?: boolean): Transaction => ({ id, isVerified });
const receipt = (id: string, status: string): GmailReceipt =>
  ({ id, status, subject: id, sender: 's', receivedAt: '2026-09-01' }) as GmailReceipt;

describe('keepConfirmed', () => {
  it('keeps only confirmed transactions and approved receipts', () => {
    const result = keepConfirmed({
      transactions: [transaction('ok', true), transaction('open', false), transaction('old')],
      receipts: [receipt('approved', 'approved'), receipt('draft', 'draft'), receipt('nr', 'needs_review')],
    });

    expect(result.transactions.map(item => item.id)).toEqual(['ok']);
    expect(result.receipts.map(item => item.id)).toEqual(['approved']);
  });
});
