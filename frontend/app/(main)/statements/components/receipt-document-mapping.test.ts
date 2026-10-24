import { describe, expect, it } from 'vitest';
import { hasReceiptAmount, mapReceiptsToStatements } from './receipt-document-mapping';

describe('mapReceiptsToStatements', () => {
  it('skips receipts without amount', () => {
    const result = mapReceiptsToStatements([
      {
        id: 'r-1',
        subject: 'Payment 1',
        sender: 'billing@example.com',
        receivedAt: '2026-02-01T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          vendor: 'Example',
        },
      },
      {
        id: 'r-2',
        subject: 'Payment 2',
        sender: 'billing@example.com',
        receivedAt: '2026-02-01T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          amount: 100,
          currency: 'USD',
          vendor: 'Example',
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-2');
  });

  it('keeps the original receipt source next to the receipt row source', () => {
    const result = mapReceiptsToStatements([
      {
        id: 'scan-1',
        source: 'scan',
        statementId: 'statement-scan-1',
        subject: 'Scanned receipt',
        sender: 'camera-scan',
        receivedAt: '2026-03-27T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
      {
        id: 'imap-1',
        source: 'imap',
        subject: 'Receipt email',
        sender: 'billing@example.com',
        receivedAt: '2026-03-27T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          amount: 90.32,
          currency: 'KZT',
          vendor: 'Walmart',
        },
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('scan-1');
    expect(result[0].source).toBe('scan');
    expect(result[0].receiptSource).toBe('scan');
    expect(result[0].statementId).toBe('statement-scan-1');
    expect(result[1].source).toBe('scan');
    expect(result[1].receiptSource).toBe('imap');
    expect(result[1].fileType).toBe('receipt');
  });

  it('includes scan receipts with linked statement even without amount', () => {
    const result = mapReceiptsToStatements([
      {
        id: 'scan-bank-1',
        source: 'scan',
        statementId: 'stmt-1',
        subject: 'Bank_statement.pdf',
        sender: 'camera-scan',
        receivedAt: '2026-05-06T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          vendor: 'Bank',
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('scan-bank-1');
    expect(result[0].source).toBe('scan');
    expect(result[0].totalDebit).toBe(0);
  });

  it('hasReceiptAmount returns true for scan receipts with linked statement', () => {
    expect(
      hasReceiptAmount({
        id: 'scan-1',
        source: 'scan',
        statementId: 'stmt-1',
        subject: 'test',
        sender: 'test',
        receivedAt: '2026-01-01',
        status: 'draft',
      }),
    ).toBe(true);
  });

  it('hasReceiptAmount returns false for emailed receipts without amount', () => {
    expect(
      hasReceiptAmount({
        id: 'imap-1',
        source: 'imap',
        subject: 'test',
        sender: 'test',
        receivedAt: '2026-01-01',
        status: 'draft',
      }),
    ).toBe(false);
  });

  it('maps uploaded store receipts to receipt rows', () => {
    const result = mapReceiptsToStatements([
      {
        id: 'upload-1',
        source: 'upload',
        subject: 'Uploaded receipt',
        sender: 'manual-upload',
        receivedAt: '2026-03-27T00:00:00.000Z',
        status: 'draft',
        parsedData: {
          amount: 24.12,
          currency: 'KZT',
          vendor: 'Magnum',
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('upload-1');
    expect(result[0].source).toBe('scan');
    expect(result[0].receiptSource).toBe('upload');
  });

  it('keeps the receipt tags so the Tag column can show them', () => {
    const tag = { id: 'tag-1', name: 'Team Trip', color: null };
    const [mapped] = mapReceiptsToStatements([
      {
        id: 'scan-tagged',
        source: 'scan',
        subject: 'Scanned receipt',
        sender: 'camera-scan',
        receivedAt: '2026-03-27T00:00:00.000Z',
        status: 'draft',
        parsedData: { amount: 12, currency: 'USD', vendor: 'ACME Store' },
        tags: [tag],
      },
    ]);

    expect(mapped.tags).toEqual([tag]);
  });
});
