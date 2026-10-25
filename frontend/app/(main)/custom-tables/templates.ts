import { COLOR_PRESETS } from './[id]/utils/colorPalette';
import type { ColumnType, CustomTableColumnConfig, SelectOptionDef } from './[id]/utils/types';

export type TableTemplateId = 'invoices' | 'payables' | 'budget' | 'pipeline' | 'subscriptions';

export interface TemplateColumn {
  /** Ключ внутри шаблона: по нему из словаря берётся название и подставляются ссылки формул. */
  key: string;
  type: ColumnType;
  config?: CustomTableColumnConfig;
  isRequired?: boolean;
  isUnique?: boolean;
  /** Формула, считающая деньги: получает валюту воркспейса, как денежная колонка. */
  money?: boolean;
}

export interface TableTemplate {
  id: TableTemplateId;
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
    columns: [
      { key: 'invoiceNumber', type: 'text', isRequired: true, isUnique: true },
      { key: 'client', type: 'text' },
      { key: 'issueDate', type: 'date' },
      { key: 'dueDate', type: 'date' },
      { key: 'amount', type: 'currency' },
      { key: 'paid', type: 'boolean' },
      {
        key: 'status',
        type: 'select',
        config: {
          options: [
            option('draft', 'gray'),
            option('sent', 'blue'),
            option('paid', 'green'),
            option('overdue', 'red'),
          ],
        },
      },
      { key: 'notes', type: 'text' },
    ],
  },
  {
    id: 'payables',
    columns: [
      { key: 'vendor', type: 'text', isRequired: true },
      { key: 'invoiceNumber', type: 'text' },
      { key: 'dueDate', type: 'date' },
      { key: 'amount', type: 'currency' },
      {
        key: 'category',
        type: 'select',
        config: {
          options: [
            option('rent', 'violet'),
            option('utilities', 'teal'),
            option('services', 'blue'),
            option('goods', 'amber'),
            option('other', 'gray'),
          ],
        },
      },
      { key: 'paid', type: 'boolean' },
      {
        key: 'status',
        type: 'select',
        config: {
          options: [
            option('pending', 'amber'),
            option('approved', 'blue'),
            option('paid', 'green'),
            option('rejected', 'red'),
          ],
        },
      },
    ],
  },
  {
    id: 'budget',
    columns: [
      { key: 'category', type: 'text', isRequired: true },
      { key: 'period', type: 'date' },
      { key: 'planned', type: 'currency' },
      { key: 'actual', type: 'currency' },
      {
        key: 'variance',
        type: 'formula',
        money: true,
        config: { expression: '[actual] - [planned]' },
      },
      {
        key: 'usedPercent',
        type: 'formula',
        config: { expression: '[actual] / [planned] * 100', format: 'percent', precision: 0 },
      },
      { key: 'owner', type: 'text' },
    ],
  },
  {
    id: 'pipeline',
    columns: [
      { key: 'deal', type: 'text', isRequired: true },
      { key: 'company', type: 'text' },
      {
        key: 'stage',
        type: 'select',
        config: {
          options: [
            option('lead', 'gray'),
            option('qualified', 'blue'),
            option('proposal', 'violet'),
            option('negotiation', 'amber'),
            option('won', 'green'),
            option('lost', 'red'),
          ],
        },
      },
      { key: 'amount', type: 'currency' },
      {
        key: 'probability',
        type: 'number',
        config: { format: 'percent', precision: 0 },
      },
      {
        key: 'weighted',
        type: 'formula',
        money: true,
        config: { expression: '[amount] * [probability] / 100' },
      },
      { key: 'closeDate', type: 'date' },
      { key: 'owner', type: 'text' },
    ],
  },
  {
    id: 'subscriptions',
    columns: [
      { key: 'service', type: 'text', isRequired: true },
      { key: 'plan', type: 'text' },
      {
        key: 'billing',
        type: 'select',
        config: { options: [option('monthly', 'blue'), option('yearly', 'violet')] },
      },
      { key: 'amount', type: 'currency' },
      { key: 'nextCharge', type: 'date' },
      { key: 'active', type: 'boolean' },
      {
        key: 'category',
        type: 'select',
        config: {
          options: [
            option('software', 'blue'),
            option('infrastructure', 'teal'),
            option('marketing', 'orange'),
            option('other', 'gray'),
          ],
        },
      },
      { key: 'notes', type: 'text' },
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

/** Варианты выбора хранятся ключами словаря; в таблицу они уходят переведёнными. */
const translateOptions = (
  config: CustomTableColumnConfig,
  options: Record<string, string>,
): CustomTableColumnConfig =>
  config.options
    ? {
        ...config,
        options: config.options.map(item =>
          typeof item === 'string'
            ? (options[item] ?? item)
            : { ...item, value: options[item.value] ?? item.value },
        ),
      }
    : { ...config };

/**
 * Тело POST /columns для каждой колонки шаблона в нужном порядке. Названия и
 * варианты выбора — на языке пользователя: они становятся данными его таблицы.
 */
export function buildTemplateColumnPayloads(
  template: TableTemplate,
  {
    titles,
    options,
    currency,
  }: { titles: Record<string, string>; options: Record<string, string>; currency: string },
): TemplateColumnPayload[] {
  return template.columns.map(column => {
    const config: CustomTableColumnConfig | undefined =
      column.type === 'currency' || column.money
        ? { precision: 2, ...(column.config ?? {}), currency }
        : column.config
          ? translateOptions(column.config, options)
          : undefined;
    return {
      templateKey: column.key,
      body: {
        title: titles[column.key] ?? column.key,
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
