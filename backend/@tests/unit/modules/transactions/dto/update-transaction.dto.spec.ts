import { rejectedFields } from '../../../../helpers/schema-body';
import { UpdateTransactionBody } from '@/contracts';
import { TransactionType } from '@/entities/transaction.entity';

describe('UpdateTransactionBody', () => {
  it('passes validation when all fields are absent (full optional)', async () => {
    const errors = rejectedFields(UpdateTransactionBody, {});
    expect(errors).toHaveLength(0);
  });

  it('passes validation with all valid fields', async () => {
    const errors = rejectedFields(UpdateTransactionBody, {
      transactionDate: '2026-01-15',
      documentNumber: 'DOC-001',
      counterpartyName: 'Acme Corp',
      counterpartyBin: '123456789012',
      counterpartyAccount: 'KZ123456789',
      counterpartyBank: 'Halyk Bank',
      debit: 1000.50,
      credit: 0,
      amountForeign: 25.00,
      exchangeRate: 450.5,
      amount: 1000.50,
      currency: 'KZT',
      paymentPurpose: 'Services rendered',
      categoryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      branchId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
      walletId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      article: 'expense',
      activityType: 'purchase',
      transactionType: TransactionType.EXPENSE,
      comments: 'Approved by finance',
      isVerified: true,
    });
    expect(errors).toHaveLength(0);
  });

  describe('transactionDate', () => {
    it('passes validation for ISO date string', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { transactionDate: '2026-01-15' });
      expect(errors.filter(field => field === 'transactionDate')).toHaveLength(0);
    });

    it('fails validation for non-date string', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { transactionDate: 'not-a-date' });
      expect(errors.some(field => field === 'transactionDate')).toBe(true);
    });
  });

  describe('financial amount fields', () => {
    it('passes validation with numeric debit', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { debit: 500.75 });
      expect(errors.filter(field => field === 'debit')).toHaveLength(0);
    });

    it('fails validation when debit is a string that is not a number', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { debit: 'five hundred' });
      expect(errors.some(field => field === 'debit')).toBe(true);
    });

    it('passes validation with zero debit', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { debit: 0 });
      expect(errors.filter(field => field === 'debit')).toHaveLength(0);
    });
  });

  describe('UUID fields (injection prevention)', () => {
    it('passes validation with valid UUID categoryId', async () => {
      const errors = rejectedFields(UpdateTransactionBody, {
        categoryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      });
      expect(errors.filter(field => field === 'categoryId')).toHaveLength(0);
    });

    it('fails validation for non-UUID categoryId', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { categoryId: 'not-a-uuid' });
      expect(errors.some(field => field === 'categoryId')).toBe(true);
    });

    it('fails validation for SQL injection attempt in categoryId', async () => {
      const errors = rejectedFields(UpdateTransactionBody, {
        categoryId: "'; DROP TABLE transactions; --",
      });
      expect(errors.some(field => field === 'categoryId')).toBe(true);
    });

    it('fails validation for non-UUID branchId', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { branchId: '12345' });
      expect(errors.some(field => field === 'branchId')).toBe(true);
    });

    it('fails validation for non-UUID walletId', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { walletId: '../../../etc/passwd' });
      expect(errors.some(field => field === 'walletId')).toBe(true);
    });
  });

  describe('transactionType enum', () => {
    it('passes validation with valid TransactionType enum value', async () => {
      const errors = rejectedFields(UpdateTransactionBody, {
        transactionType: TransactionType.EXPENSE,
      });
      expect(errors.filter(field => field === 'transactionType')).toHaveLength(0);
    });

    it('fails validation with arbitrary string for transactionType', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { transactionType: 'malicious_type' });
      expect(errors.some(field => field === 'transactionType')).toBe(true);
    });
  });

  describe('isVerified boolean field', () => {
    it('passes validation with boolean true', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { isVerified: true });
      expect(errors.filter(field => field === 'isVerified')).toHaveLength(0);
    });

    it('fails validation with string "true" (not boolean)', async () => {
      const errors = rejectedFields(UpdateTransactionBody, { isVerified: 'true' });
      expect(errors.some(field => field === 'isVerified')).toBe(true);
    });
  });
});
