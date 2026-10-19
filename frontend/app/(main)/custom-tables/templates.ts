import { COLOR_PRESETS } from './[id]/utils/colorPalette';
import type { ColumnType, CustomTableColumnConfig, SelectOptionDef } from './[id]/utils/types';

export type TableTemplateId = 'invoices' | 'payables' | 'budget' | 'pipeline' | 'subscriptions';

export interface TemplateColumn {
  /** Ключ внутри шаблона: по нему подставляются названия и ссылки формул. */
  key: string;
  /** Английское название — запасной вариант, если в словаре нет перевода. */
  title: string;
  type: ColumnType;
  config?: CustomTableColumnConfig;
  isRequired?: boolean;
  isUnique?: boolean;
  /** Формула, считающая деньги: получает валюту воркспейса, как денежная колонка. */
  money?: boolean;
}

export interface TableTemplate {
  id: TableTemplateId;
  name: string;
  description: string;
  columns: TemplateColumn[];
}

const preset = (id: string): string => COLOR_PRESETS.find(p => p.id === id)?.base ?? '#6b7280';

const option = (value: string, color?: string): SelectOptionDef => ({
  value,
  ...(color ? { color: preset(color) } : {}),
});

/**
 * Денежные колонки идут без валюты: она подставляется из воркспейса при
 * создании (см. buildTemplateColumnPayloads). Формулы ссылаются на ключи
 * шаблона в квадратных скобках — сервер генерирует свои ключи, поэтому они
 * заменяются по ходу последовательного создания колонок.
 */
export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: 'invoices',
    name: 'Invoices',
    description: 'Issued invoices with due dates, payment status and totals.',
    columns: [
      { key: 'invoiceNumber', title: 'Invoice #', type: 'text', isRequired: true, isUnique: true },
      { key: 'client', title: 'Client', type: 'text' },
      { key: 'issueDate', title: 'Issue date', type: 'date' },
      { key: 'dueDate', title: 'Due date', type: 'date' },
      { key: 'amount', title: 'Amount', type: 'currency' },
      { key: 'paid', title: 'Paid', type: 'boolean' },
      {
        key: 'status',
        title: 'Status',
        type: 'select',
        config: {
          options: [
            option('Draft', 'gray'),
            option('Sent', 'blue'),
            option('Paid', 'green'),
            option('Overdue', 'red'),
          ],
        },
      },
      { key: 'notes', title: 'Notes', type: 'text' },
    ],
  },
  {
    id: 'payables',
    name: 'Payables',
    description: 'Supplier bills to approve and pay, with due dates.',
    columns: [
      { key: 'vendor', title: 'Vendor', type: 'text', isRequired: true },
      { key: 'invoiceNumber', title: 'Invoice #', type: 'text' },
      { key: 'dueDate', title: 'Due date', type: 'date' },
      { key: 'amount', title: 'Amount', type: 'currency' },
      {
        key: 'category',
        title: 'Category',
        type: 'select',
        config: {
          options: [
            option('Rent', 'violet'),
            option('Utilities', 'teal'),
            option('Services', 'blue'),
            option('Goods', 'amber'),
            option('Other', 'gray'),
          ],
        },
      },
      { key: 'paid', title: 'Paid', type: 'boolean' },
      {
        key: 'status',
        title: 'Status',
        type: 'select',
        config: {
          options: [
            option('Pending', 'amber'),
            option('Approved', 'blue'),
            option('Paid', 'green'),
            option('Rejected', 'red'),
          ],
        },
      },
    ],
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Planned vs actual spend by category, with variance and usage.',
    columns: [
      { key: 'category', title: 'Category', type: 'text', isRequired: true },
      { key: 'period', title: 'Period', type: 'date' },
      { key: 'planned', title: 'Planned', type: 'currency' },
      { key: 'actual', title: 'Actual', type: 'currency' },
      {
        key: 'variance',
        title: 'Variance',
        type: 'formula',
        money: true,
        config: { expression: '[actual] - [planned]' },
      },
      {
        key: 'usedPercent',
        title: 'Used %',
        type: 'formula',
        config: { expression: '[actual] / [planned] * 100', format: 'percent', precision: 0 },
      },
      { key: 'owner', title: 'Owner', type: 'text' },
    ],
  },
  {
    id: 'pipeline',
    name: 'Sales pipeline',
    description: 'Deals by stage with amount, probability and weighted value.',
    columns: [
      { key: 'deal', title: 'Deal', type: 'text', isRequired: true },
      { key: 'company', title: 'Company', type: 'text' },
      {
        key: 'stage',
        title: 'Stage',
        type: 'select',
        config: {
          options: [
            option('Lead', 'gray'),
            option('Qualified', 'blue'),
            option('Proposal', 'violet'),
            option('Negotiation', 'amber'),
            option('Won', 'green'),
            option('Lost', 'red'),
          ],
        },
      },
      { key: 'amount', title: 'Amount', type: 'currency' },
      {
        key: 'probability',
        title: 'Probability',
        type: 'number',
        config: { format: 'percent', precision: 0 },
      },
      {
        key: 'weighted',
        title: 'Weighted value',
        type: 'formula',
        money: true,
        config: { expression: '[amount] * [probability] / 100' },
      },
      { key: 'closeDate', title: 'Expected close', type: 'date' },
      { key: 'owner', title: 'Owner', type: 'text' },
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Recurring services with billing period and next charge date.',
    columns: [
      { key: 'service', title: 'Service', type: 'text', isRequired: true },
      { key: 'plan', title: 'Plan', type: 'text' },
      {
        key: 'billing',
        title: 'Billing',
        type: 'select',
        config: { options: [option('Monthly', 'blue'), option('Yearly', 'violet')] },
      },
      { key: 'amount', title: 'Amount', type: 'currency' },
      { key: 'nextCharge', title: 'Next charge', type: 'date' },
      { key: 'active', title: 'Active', type: 'boolean' },
      {
        key: 'category',
        title: 'Category',
        type: 'select',
        config: {
          options: [
            option('Software', 'blue'),
            option('Infrastructure', 'teal'),
            option('Marketing', 'orange'),
            option('Other', 'gray'),
          ],
        },
      },
      { key: 'notes', title: 'Notes', type: 'text' },
    ],
  },
];

export interface TemplateColumnPayload {
  templateKey: string;
  body: {
    title: string;
    type: ColumnType;
    isRequired: boolean;
    isUnique: boolean;
    config?: CustomTableColumnConfig;
  };
}

/** Тело POST /columns для каждой колонки шаблона в нужном порядке. */
export function buildTemplateColumnPayloads(
  template: TableTemplate,
  { titles, currency }: { titles: Record<string, string>; currency: string },
): TemplateColumnPayload[] {
  return template.columns.map(column => {
    const config: CustomTableColumnConfig | undefined =
      column.type === 'currency' || column.money
        ? { precision: 2, ...(column.config ?? {}), currency }
        : column.config
          ? { ...column.config }
          : undefined;
    return {
      templateKey: column.key,
      body: {
        title: titles[column.key] ?? column.title,
        type: column.type,
        isRequired: Boolean(column.isRequired),
        isUnique: Boolean(column.isUnique),
        ...(config ? { config } : {}),
      },
    };
  });
}

/** [templateKey] → [serverKey]; неизвестные ссылки остаются как есть. */
export function substituteFormulaKeys(expression: string, keyMap: Record<string, string>): string {
  return expression.replace(/\[([^\]]+)\]/g, (match, key: string) =>
    keyMap[key] ? `[${keyMap[key]}]` : match,
  );
}

export interface ApplyTemplateResult {
  keyMap: Record<string, string>;
  failed: string[];
}

/**
 * Колонки создаются строго по очереди: формула проверяется сервером и должна
 * ссылаться на уже существующие ключи, которые известны только из ответа.
 */
export async function applyTemplate({
  tableId,
  payloads,
  post,
}: {
  tableId: string;
  payloads: TemplateColumnPayload[];
  post: (url: string, body: TemplateColumnPayload['body']) => Promise<{ key?: string } | null>;
}): Promise<ApplyTemplateResult> {
  const keyMap: Record<string, string> = {};
  const failed: string[] = [];
  for (const payload of payloads) {
    const expression = payload.body.config?.expression;
    const body =
      typeof expression === 'string'
        ? {
            ...payload.body,
            config: {
              ...payload.body.config,
              expression: substituteFormulaKeys(expression, keyMap),
            },
          }
        : payload.body;
    try {
      const created = await post(`/custom-tables/${tableId}/columns`, body);
      if (created?.key) {
        keyMap[payload.templateKey] = created.key;
      } else {
        failed.push(payload.templateKey);
      }
    } catch (error) {
      console.error('Failed to create template column:', payload.templateKey, error);
      failed.push(payload.templateKey);
    }
  }
  return { keyMap, failed };
}
