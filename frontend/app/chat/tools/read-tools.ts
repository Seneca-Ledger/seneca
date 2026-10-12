import { z } from 'zod';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { ChatTool } from './types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const listTransactionsSchema = z.object({
  search: z.string().min(1).max(200).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  type: z.enum(['income', 'expense']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const spendReportSchema = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
});

/**
 * Read tools run automatically: they only reuse workspace-scoped GET endpoints
 * the dashboard and statements pages already call.
 */
export const readTools: ChatTool[] = [
  {
    name: 'get_dashboard',
    promptLine: 'get_dashboard {} — сводка: баланс, доходы/расходы за 30 дней, топ категорий',
    kind: 'read',
    schema: z.object({}),
    summarize: () => 'Сводка по финансам',
    execute: async () => {
      const response = await apiClient.get('/dashboard');
      return response.data;
    },
  },
  {
    name: 'list_transactions',
    promptLine:
      'list_transactions {search?: string, dateFrom?: "YYYY-MM-DD", dateTo?: "YYYY-MM-DD", type?: "income"|"expense", limit?: number} — найти транзакции',
    kind: 'read',
    schema: listTransactionsSchema,
    summarize: params => {
      const p = params as z.infer<typeof listTransactionsSchema>;
      return `Поиск транзакций${p.search ? `: «${p.search}»` : ''}`;
    },
    execute: async params => {
      const p = params as z.infer<typeof listTransactionsSchema>;
      if (p.search) {
        // Semantic search over transactions — same endpoint the analysis chat uses.
        const response = await apiClient.post('/ai-analysis/search', {
          query: p.search,
          limit: p.limit ?? 20,
        } satisfies ContractInput<'SearchTransactionsBody'>);
        return response.data;
      }
      const response = await apiClient.get('/transactions', {
        params: {
          date_from: p.dateFrom,
          date_to: p.dateTo,
          type: p.type,
          limit: p.limit ?? 20,
        },
      });
      return response.data;
    },
  },
  {
    name: 'list_categories',
    promptLine: 'list_categories {} — список категорий расходов/доходов',
    kind: 'read',
    schema: z.object({}),
    summarize: () => 'Список категорий',
    execute: async () => {
      const response = await apiClient.get('/categories');
      return response.data;
    },
  },
  {
    name: 'spend_report',
    promptLine:
      'spend_report {dateFrom: "YYYY-MM-DD", dateTo: "YYYY-MM-DD"} — отчёт о тратах за период',
    kind: 'read',
    schema: spendReportSchema,
    summarize: params => {
      const p = params as z.infer<typeof spendReportSchema>;
      return `Отчёт о тратах ${p.dateFrom} — ${p.dateTo}`;
    },
    execute: async params => {
      const p = params as z.infer<typeof spendReportSchema>;
      const response = await apiClient.get('/reports/spend-over-time', {
        params: { dateFrom: p.dateFrom, dateTo: p.dateTo, type: 'expense' },
      });
      return response.data;
    },
  },
];
