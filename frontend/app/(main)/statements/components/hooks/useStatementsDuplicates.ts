'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';
import { getStatementDisplayMerchant, getStatementMerchantLabel } from '@/app/lib/statement-status';
import {
  DUPLICATE_GROUP_TONES,
  formatStatementAmount,
  formatStatementDate,
  getBankDisplayName,
  isGmailStatement,
  isReceiptProcessing,
  toDuplicateGroupLabel,
} from '../StatementsListView.utils';
import type { DuplicateMeta, DuplicateOverride } from './useStatementSelection';

interface StatementForDuplicates {
  id: string;
  source?: string;
  bankName: string;
  status: string;
  createdAt: string;
  fileName: string;
  subject?: string;
  sender?: string;
  parsedData?: { vendor?: string };
  parsingDetails?: {
    detectedBy?: string;
    parserUsed?: string;
    importPreview?: { source?: string; merchant?: string };
  } | null;
}

interface UseStatementsDuplicatesParams {
  displayStatements: StatementForDuplicates[];
  scanningLabel: string;
}

interface DuplicateTexts {
  sameReason: string;
  manualReason: string;
  manualGroup: string;
}

interface UseStatementsDuplicatesReturn {
  duplicateOverrides: Record<string, DuplicateOverride>;
  setDuplicateOverrides: Dispatch<SetStateAction<Record<string, DuplicateOverride>>>;
  duplicateMetaById: Map<string, DuplicateMeta>;
}

function buildDuplicateGroupsFromStatements(
  displayStatements: StatementForDuplicates[],
  duplicateOverrides: Record<string, DuplicateOverride>,
  scanningLabel: string,
  texts: DuplicateTexts,
): Map<string, DuplicateMeta> {
  const duplicateGroups = new Map<
    string,
    Array<{ statement: StatementForDuplicates; createdAtTimestamp: number }>
  >();
  const isKnownStatement = new Set(displayStatements.map(s => s.id));

  for (const statement of displayStatements) {
    const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
    const isProcessingReceipt = isReceiptProcessing(statement);
    const amountLabel = formatStatementAmount(statement);
    const override = duplicateOverrides[statement.id]?.state;

    if (override === 'not_duplicate') {
      continue;
    }

    const isZeroAmount = amountLabel === '-' || amountLabel === '0' || amountLabel === '0.00';
    if (isZeroAmount || isProcessingReceipt || statement.status === 'processing') {
      continue;
    }

    const resolvedName = buildResolvedName(isReceipt, statement);
    const merchantLabel = isReceipt
      ? resolvedName
      : getStatementMerchantLabel(statement.status, resolvedName, scanningLabel);
    const dateLabel = formatStatementDate(statement);
    const signature = `${merchantLabel}::${amountLabel}::${dateLabel}`;
    const createdAtTimestamp = getCreatedAtTimestamp(statement.createdAt);
    const existingGroup = duplicateGroups.get(signature);

    if (existingGroup) {
      existingGroup.push({ statement, createdAtTimestamp });
    } else {
      duplicateGroups.set(signature, [{ statement, createdAtTimestamp }]);
    }
  }

  return buildMetaFromGroups(duplicateGroups, duplicateOverrides, isKnownStatement, texts);
}

function buildResolvedName(isReceipt: boolean, statement: StatementForDuplicates): string {
  if (isReceipt) {
    return resolveGmailMerchantLabel({
      vendor: statement.parsedData?.vendor,
      sender: isGmailStatement(statement) ? statement.sender : undefined,
      subject: statement.subject,
      fallback: statement.fileName,
    });
  }
  return getStatementDisplayMerchant(statement, getBankDisplayName(statement.bankName));
}

function getCreatedAtTimestamp(createdAt: string): number {
  const ts = new Date(createdAt).getTime();
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function buildMetaFromGroups(
  duplicateGroups: Map<
    string,
    Array<{ statement: StatementForDuplicates; createdAtTimestamp: number }>
  >,
  duplicateOverrides: Record<string, DuplicateOverride>,
  isKnownStatement: Set<string>,
  texts: DuplicateTexts,
): Map<string, DuplicateMeta> {
  const metaById = new Map<string, DuplicateMeta>();
  let duplicateGroupOrder = 0;

  duplicateGroups.forEach(group => {
    if (group.length < 2) {
      return;
    }

    const sortedGroup = [...group].sort((a, b) => {
      if (a.createdAtTimestamp === b.createdAtTimestamp) {
        return a.statement.id.localeCompare(b.statement.id);
      }
      return a.createdAtTimestamp - b.createdAtTimestamp;
    });

    const primaryId = sortedGroup[0]?.statement.id ?? '';
    const groupLabel = toDuplicateGroupLabel(duplicateGroupOrder);

    const groupTone = DUPLICATE_GROUP_TONES[duplicateGroupOrder % DUPLICATE_GROUP_TONES.length];
    duplicateGroupOrder += 1;

    sortedGroup.forEach(({ statement }, index) => {
      metaById.set(statement.id, {
        position: index + 1,
        total: sortedGroup.length,
        role: index === 0 ? 'primary' : 'suspected',
        reason: texts.sameReason,
        groupKey: '',
        groupLabel,
        groupTone,
        primaryId,
      });
    });
  });

  applyManualOverrides(metaById, duplicateOverrides, isKnownStatement, texts);

  return metaById;
}

function applyManualOverrides(
  metaById: Map<string, DuplicateMeta>,
  duplicateOverrides: Record<string, DuplicateOverride>,
  isKnownStatement: Set<string>,
  texts: DuplicateTexts,
): void {
  Object.entries(duplicateOverrides).forEach(([statementId, override]) => {
    if (override?.state !== 'duplicate') {
      return;
    }
    if (!isKnownStatement.has(statementId) || metaById.has(statementId)) {
      return;
    }

    const manualGroupKey = override.groupKey ?? `manual:${statementId}`;
    const manualGroupLabel = override.groupLabel ?? texts.manualGroup;
    const manualGroupTone = override.groupTone ?? 'stone';
    const manualPrimaryId = override.primaryId ?? statementId;

    metaById.set(statementId, {
      position: override.position ?? 1,
      total: override.total ?? 1,
      role: override.primaryId === statementId ? 'primary' : 'suspected',
      reason: texts.manualReason,
      groupKey: manualGroupKey,
      groupLabel: manualGroupLabel,
      groupTone: manualGroupTone,
      primaryId: manualPrimaryId,
    });
  });
}

export function useStatementsDuplicates({
  displayStatements,
  scanningLabel,
}: UseStatementsDuplicatesParams): UseStatementsDuplicatesReturn {
  const [duplicateOverrides, setDuplicateOverridesState] = useState<
    Record<string, DuplicateOverride>
  >({});

  const setDuplicateOverrides: Dispatch<
    SetStateAction<Record<string, DuplicateOverride>>
  > = updater => {
    setDuplicateOverridesState(updater);
  };

  const listText = useIntlayer('statementsListUi');
  const sameReason = listText.duplicateReasonSame.value;
  const manualReason = listText.duplicateReasonManual.value;
  const manualGroup = listText.groupManual.value;

  const duplicateMetaById = useMemo(
    () =>
      buildDuplicateGroupsFromStatements(displayStatements, duplicateOverrides, scanningLabel, {
        sameReason,
        manualReason,
        manualGroup,
      }),
    [displayStatements, duplicateOverrides, scanningLabel, sameReason, manualReason, manualGroup],
  );

  return { duplicateOverrides, setDuplicateOverrides, duplicateMetaById };
}
