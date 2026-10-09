import { z } from 'zod';
import apiClient from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { ChatTool } from './types';

/** Every write the assistant performs is audited as the assistant, not as the user. */
export const AI_ACTOR_HEADERS = { 'X-Lumio-Actor': 'ai-chat' } as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const createExpenseSchema = z.object({
  amount: z.number().positive().finite(),
  merchant: z.string().min(1).max(255),
  date: isoDate,
  categoryId: z.string().uuid(),
  categoryName: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
});

const setCategorySchema = z.object({
  transactionId: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string().min(1).max(120).optional(),
});

function formatAmount(amount: number, currency?: string): string {
  return `${amount.toLocaleString('ru-RU')} ${currency ?? FALLBACK_CURRENCY}`;
}

/**
 * Write tools are executed only after the user taps the confirmation card —
 * never directly from model output. See ChatToolKind in ./types.
 *
 * Every create sends an idempotency key (honoured by the backend since stage 1
 * of the chat-mode plan) so a retried request cannot double-write.
 */
export const writeTools: ChatTool[] = [
  {
    name: 'create_expense',
    promptLine:
      'create_expense {amount: number, merchant: string, date: "YYYY-MM-DD", categoryId: uuid, description?: string, currency?: string} — записать расход (categoryId бери из list_categories)',
    kind: 'write',
    schema: createExpenseSchema,
    summarize: params => {
      const p = params as z.infer<typeof createExpenseSchema>;
      const category = p.categoryName ? `, категория «${p.categoryName}»` : '';
      return `Расход ${formatAmount(p.amount, p.currency)} — ${p.merchant} (${p.date})${category}`;
    },
    execute: async params => {
      const p = params as z.infer<typeof createExpenseSchema>;
      // The manual-expense endpoint is multipart because it accepts receipt
      // files; chat mode sends no files but must keep the same content type.
      const formData = new FormData();
      formData.append('amount', String(p.amount));
      formData.append('currency', p.currency ?? FALLBACK_CURRENCY);
      formData.append('merchant', p.merchant);
      formData.append('description', p.description ?? '');
      formData.append('categoryId', p.categoryId);
      formData.append('date', p.date);
      const response = await apiClient.post('/statements/manual-expense', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...AI_ACTOR_HEADERS,
          'idempotency-key': crypto.randomUUID(),
        },
      });
      return response.data;
    },
  },
  {
    name: 'set_transaction_category',
    promptLine:
      'set_transaction_category {transactionId: uuid, categoryId: uuid, categoryName?: string} — сменить категорию транзакции (id бери из list_transactions и list_categories)',
    kind: 'write',
    schema: setCategorySchema,
    summarize: params => {
      const p = params as z.infer<typeof setCategorySchema>;
      return `Сменить категорию транзакции на «${p.categoryName ?? p.categoryId}»`;
    },
    execute: async params => {
      const p = params as z.infer<typeof setCategorySchema>;
      const response = await apiClient.put(
        `/transactions/${p.transactionId}`,
        {
          categoryId: p.categoryId,
        },
        { headers: AI_ACTOR_HEADERS },
      );
      return response.data;
    },
  },
];
