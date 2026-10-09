'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceMembers } from '@/app/hooks/useNotes';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { apiQuery } from '@/app/lib/query-fn';
import type { LotDetailsInput, MetalLot, MetalReceipt } from '../hooks/useMetals';

interface LotDetailsDialogProps {
  /** The lot being looked at; the dialog is closed while null. */
  lot: MetalLot | null;
  currency: string;
  locale: string;
  saving: boolean;
  onClose: () => void;
  onSave: (lot: MetalLot, input: LotDetailsInput) => void;
  onUploadPhoto: (lot: MetalLot, file: File) => void;
  onRemovePhoto: (lot: MetalLot) => void;
}

/**
 * Everything about a lot that is not a number on the table: what it looks
 * like, where it is kept, what it is insured for, and the receipt that proves
 * the purchase.
 */
export function LotDetailsDialog({
  lot,
  currency,
  locale,
  saving,
  onClose,
  onSave,
  onUploadPhoto,
  onRemovePhoto,
}: LotDetailsDialogProps) {
  const t = useIntlayer('netWorthPage');
  const workspaceId = useWorkspaceId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState('');
  const [insured, setInsured] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const members = useWorkspaceMembers();

  const receipts = useQuery({
    queryKey: ['metals', 'receipt-options', workspaceId],
    queryFn: ({ signal }) => apiQuery<MetalReceipt[]>({ url: '/metals/receipt-options', signal }),
    enabled: Boolean(workspaceId && lot),
  });

  useEffect(() => {
    if (!lot) return;
    setStorage(lot.storageLocation ?? '');
    setInsured(lot.insuredValue === null ? '' : String(lot.insuredValue));
    setReceiptId(lot.receipt?.id ?? '');
    setOwnerUserId(lot.ownerUserId ?? '');
  }, [lot]);

  if (!lot) return null;

  const options = [
    { value: '', label: t.noReceipt.value },
    ...(receipts.data ?? []).map(receipt => ({
      value: receipt.id,
      label: [
        receipt.vendor ?? receipt.id.slice(0, 8),
        receipt.date,
        receipt.amount !== null && receipt.currency
          ? formatMoney(receipt.amount, receipt.currency, locale)
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  ];

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={lot.name}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={() =>
            onSave(lot, {
              storageLocation: storage.trim(),
              insuredValue: insured.trim() ? Number(insured) : undefined,
              receiptId: receiptId || null,
              ownerUserId: ownerUserId || null,
            })
          }
          confirmText={t.save.value}
          isConfirmLoading={saving}
          isConfirmDisabled={saving}
        />
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {lot.photoUrl ? (
            <Box
              component="img"
              src={lot.photoUrl}
              alt={`${t.photo.value}: ${lot.name}`}
              sx={{
                width: 140,
                height: 140,
                objectFit: 'cover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 140,
                height: 140,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: 12,
              }}
            >
              {t.photo}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={saving}
              onClick={() => fileInput.current?.click()}
            >
              {t.uploadPhoto}
            </Button>
            {lot.photoUrl && (
              <Button
                size="small"
                variant="text"
                color="error"
                disabled={saving}
                onClick={() => onRemovePhoto(lot)}
              >
                {t.delete}
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              aria-label={t.uploadPhoto.value}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onUploadPhoto(lot, file);
                event.target.value = '';
              }}
            />
          </Box>
        </Box>

        <TextField
          size="small"
          label={t.storageLocation.value}
          value={storage}
          onChange={event => setStorage(event.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label={`${t.insuredValue.value} (${currency})`}
          value={insured}
          onChange={event => setInsured(event.target.value)}
          inputProps={{ inputMode: 'decimal' }}
          helperText={`${t.value.value}: ${formatMoney(lot.value, currency, locale)}`}
          fullWidth
        />
        {members.length > 1 && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t.owner}
            </Typography>
            <Select
              size="small"
              value={ownerUserId}
              onChange={value => setOwnerUserId(value)}
              inputProps={{ 'aria-label': t.owner.value }}
              options={[
                { value: '', label: '—' },
                ...members.map(member => ({ value: member.id, label: member.name })),
              ]}
              fullWidth
            />
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary">
            {t.receipt}
          </Typography>
          <Select
            size="small"
            value={receiptId}
            onChange={value => setReceiptId(value)}
            inputProps={{ 'aria-label': t.receipt.value }}
            options={options}
            fullWidth
          />
        </Box>
      </Box>
    </ModalShell>
  );
}
