'use client';

import { useMemo, useState } from 'react';
import type {
  DuplicateMeta,
  DuplicateOverride,
} from '@/app/(main)/statements/components/hooks/useStatementSelection';
import {
  DUPLICATE_GROUP_TONES,
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isGmailStatement,
  toDuplicateGroupLabel,
} from '@/app/(main)/statements/components/StatementsListView.utils';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';
import { getStatementDisplayMerchant, getStatementMerchantLabel } from '@/app/lib/statement-status';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatementForDuplicates {
  id: string;
  source?: string;
  status: string;
  bankName: string;
  createdAt: string;
  fileName: string;
  subject?: string;
  sender?: string;
  parsedData?: { vendor?: string; amount?: number; currency?: string; date?: string };
}

type GroupEntry = { statement: StatementForDuplicates; createdAtTimestamp: number };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function resolveCreatedAtMs(createdAt: string): number {
  const ms = new Date(createdAt).getTime();
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

function resolveReceiptName(statement: StatementForDuplicates): string {
  return resolveGmailMerchantLabel({
    vendor: statement.parsedData?.vendor,
    sender: isGmailStatement(statement as Parameters<typeof isGmailStatement>[0])
      ? statement.sender
      : undefined,
    subject: statement.subject,
    fallback: statement.fileName,
  });
}

function resolveBankName(statement: StatementForDuplicates): string {
  return getStatementDisplayMerchant(
    statement as Parameters<typeof getStatementDisplayMerchant>[0],
    getBankDisplayName(statement.bankName),
  );
}

function resolveMerchantLabel(statement: StatementForDuplicates, scanningLabel: string): string {
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  const resolvedName = isReceipt ? resolveReceiptName(statement) : resolveBankName(statement);
  return isReceipt
    ? resolvedName
    : getStatementMerchantLabel(statement.status, resolvedName, scanningLabel);
}

function isAmountSkippable(amountLabel: string): boolean {
  return amountLabel === '-' || amountLabel === '0' || amountLabel === '0.00';
}

function buildGroupSignature(
  statement: StatementForDuplicates,
  scanningLabel: string,
): string | null {
  const amountLabel = formatStatementAmount(
    statement as Parameters<typeof formatStatementAmount>[0],
  );
  if (isAmountSkippable(amountLabel) || statement.status === 'processing') {
    return null;
  }
  const merchantLabel = resolveMerchantLabel(statement, scanningLabel);
  const dateLabel = formatStatementDate(statement as Parameters<typeof formatStatementDate>[0]);
  return `${merchantLabel}::${amountLabel}::${dateLabel}`;
}

function buildDuplicateGroups(
  statements: StatementForDuplicates[],
  overrides: Record<string, DuplicateOverride>,
  scanningLabel: string,
): Map<string, GroupEntry[]> {
  const groups = new Map<string, GroupEntry[]>();
  for (const statement of statements) {
    if (overrides[statement.id]?.state === 'not_duplicate') {
      continue;
    }
    const signature = buildGroupSignature(statement, scanningLabel);
    if (!signature) {
      continue;
    }
    const ts = resolveCreatedAtMs(statement.createdAt);
    const existing = groups.get(signature);
    if (existing) {
      existing.push({ statement, createdAtTimestamp: ts });
    } else {
      groups.set(signature, [{ statement, createdAtTimestamp: ts }]);
    }
  }
  return groups;
}

function compareGroupEntries(a: GroupEntry, b: GroupEntry): number {
  if (a.createdAtTimestamp !== b.createdAtTimestamp) {
    return a.createdAtTimestamp - b.createdAtTimestamp;
  }
  return a.statement.id.localeCompare(b.statement.id);
}

function populateMetaFromGroup(
  group: GroupEntry[],
  groupKey: string,
  order: number,
  metaById: Map<string, DuplicateMeta>,
): void {
  const duplicateReason = 'Same merchant · same date · same amount';
  const sorted = [...group].sort(compareGroupEntries);
  const primaryId = sorted[0]?.statement.id || '';
  const groupLabel = toDuplicateGroupLabel(order);
  const groupTone = DUPLICATE_GROUP_TONES[order % DUPLICATE_GROUP_TONES.length];
  sorted.forEach(({ statement }, index) => {
    metaById.set(statement.id, {
      position: index + 1,
      total: sorted.length,
      role: index === 0 ? 'primary' : 'suspected',
      reason: duplicateReason,
      groupKey,
      groupLabel,
      groupTone,
      primaryId,
    });
  });
}

function populateMetaFromGroups(
  groups: Map<string, GroupEntry[]>,
  metaById: Map<string, DuplicateMeta>,
): void {
  let order = 0;
  groups.forEach((group, groupKey) => {
    if (group.length < 2) {
      return;
    }
    populateMetaFromGroup(group, groupKey, order, metaById);
    order += 1;
  });
}

function buildManualMeta(statementId: string, override: DuplicateOverride): DuplicateMeta {
  return {
    position: override.position || 1,
    total: override.total || 1,
    role: override.primaryId === statementId ? 'primary' : 'suspected',
    reason: 'Marked manually as duplicate',
    groupKey: override.groupKey || `manual:${statementId}`,
    groupLabel: override.groupLabel || 'Group Manual',
    groupTone: override.groupTone || 'stone',
    primaryId: override.primaryId || statementId,
  };
}

function applyManualOverrides(
  overrides: Record<string, DuplicateOverride>,
  isKnown: Set<string>,
  metaById: Map<string, DuplicateMeta>,
): void {
  for (const [id, override] of Object.entries(overrides)) {
    if (override?.state !== 'duplicate') {
      continue;
    }
    if (!isKnown.has(id) || metaById.has(id)) {
      continue;
    }
    metaById.set(id, buildManualMeta(id, override));
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseStatementsDuplicatesParams {
  displayStatements: StatementForDuplicates[];
  duplicateOverrides: Record<string, DuplicateOverride>;
  setDuplicateOverrides: React.Dispatch<React.SetStateAction<Record<string, DuplicateOverride>>>;
  scanningLabel: string;
}

interface UseStatementsDuplicatesResult {
  duplicateMetaById: Map<string, DuplicateMeta>;
  duplicateOverrides: Record<string, DuplicateOverride>;
  setDuplicateOverrides: React.Dispatch<React.SetStateAction<Record<string, DuplicateOverride>>>;
}

export function useStatementsDuplicates({
  displayStatements,
  duplicateOverrides,
  setDuplicateOverrides,
  scanningLabel,
}: UseStatementsDuplicatesParams): UseStatementsDuplicatesResult {
  const duplicateMetaById = useMemo((): Map<string, DuplicateMeta> => {
    const isKnown = new Set(displayStatements.map(s => s.id));
    const groups = buildDuplicateGroups(displayStatements, duplicateOverrides, scanningLabel);
    const metaById = new Map<string, DuplicateMeta>();
    populateMetaFromGroups(groups, metaById);
    applyManualOverrides(duplicateOverrides, isKnown, metaById);
    return metaById;
  }, [displayStatements, duplicateOverrides, scanningLabel]);

  return { duplicateMetaById, duplicateOverrides, setDuplicateOverrides };
}

export function useStatementsDuplicatesState(): {
  duplicateOverrides: Record<string, DuplicateOverride>;
  setDuplicateOverrides: React.Dispatch<React.SetStateAction<Record<string, DuplicateOverride>>>;
} {
  const [duplicateOverrides, setDuplicateOverrides] = useState<Record<string, DuplicateOverride>>(
    {},
  );
  return { duplicateOverrides, setDuplicateOverrides };
}
