'use client';
import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { buildReceiptPrefillParams } from '@/app/(main)/subscriptions/hooks/receipt-prefill';
import { CheckCircle } from '@/app/components/icons';
import type { EditableReceiptParsedData } from '@/app/components/receipts/receipt-types';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import type { ReceiptRecord } from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

/**
 * The receipt's bank row: the one it was approved onto, or the row its scan
 * made (the same lookup "Upload statement" on a subscription uses).
 */
async function receiptTransactionId(receipt: ReceiptRecord): Promise<string | null> {
  if (receipt.transactionId) return receipt.transactionId;
  if (!receipt.statementId) return null;
  const rows = await apiQueryDecoded({
    url: '/subscriptions/charge-candidates',
    params: {
      statementId: receipt.statementId,
    } satisfies ContractInput<'SubscriptionChargeCandidatesQuery'>,
    contract: 'SubscriptionChargeCandidates',
  }).catch(() => []);
  return rows.length === 1 ? rows[0].transactionId : null;
}

interface ReceiptHeaderActionsProps {
  receipt: ReceiptRecord;
  formValue: EditableReceiptParsedData;
  saving: boolean;
  exportDisabled: boolean;
  onDownload: () => void;
  onExport: () => void;
  onApprove: () => void;
}

export function ReceiptHeaderActions({
  receipt,
  formValue,
  saving,
  exportDisabled,
  onDownload,
  onExport,
  onApprove,
}: ReceiptHeaderActionsProps) {
  const t = useIntlayer('receiptDocumentPage');
  const router = useRouter();

  // The fields as corrected on this page, not as first read from the document.
  const openAsSubscription = async () => {
    const params = buildReceiptPrefillParams({
      vendor: formValue.vendor,
      amount: Number(formValue.amount) || 0,
      currency: formValue.currency,
      date: formValue.date,
      transactionId: await receiptTransactionId(receipt),
    });
    router.push(`/subscriptions?${params}`);
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <DetailActionButton variant="ghost" type="button" onClick={() => void openAsSubscription()}>
        {t.markAsSubscription}
      </DetailActionButton>
      <DetailActionButton variant="ghost" type="button" onClick={onDownload}>
        {t.download}
      </DetailActionButton>
      <DetailActionButton
        variant="ghost"
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
      >
        {t.exportToTable}
      </DetailActionButton>
      {/* Approving again books nothing new, so an approved receipt says so instead. */}
      {receipt.status === 'approved' ? (
        <Box
          role="status"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            height: 32,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--primary)',
          }}
        >
          <CheckCircle size={18} />
          {t.approvedState}
        </Box>
      ) : (
        <DetailActionButton variant="default" type="button" onClick={onApprove} disabled={saving}>
          {saving ? <Spinner className="size-[18px] mr-2" /> : null}
          {t.approve}
        </DetailActionButton>
      )}
    </Box>
  );
}
