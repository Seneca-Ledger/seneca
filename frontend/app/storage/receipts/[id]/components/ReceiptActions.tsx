'use client';
import { Box, Typography } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Table } from '@/app/components/icons';
import type { EditableReceiptParsedData } from '@/app/components/receipts/receipt-types';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { Spinner } from '@/app/components/ui/spinner';
import type { ReceiptRecord } from '@/app/lib/api';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { buildExportData, createExportTable } from './export-helpers';

interface ExportConfirmDialogProps {
  open: boolean;
  exportingToTable: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ExportConfirmDialog({
  open,
  exportingToTable,
  onClose,
  onConfirm,
}: ExportConfirmDialogProps): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 22, fontWeight: 600 }}>Confirm export</DialogTitle>
      <DialogContent dividers>
        <Typography style={{ fontSize: 16, lineHeight: 2, color: c.ink800 }}>
          Are you sure you want to export this statement to a custom table?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 4, py: 3, gap: 1.5 }}>
        <Box
          component="button"
          type="button"
          onClick={onClose}
          sx={{
            border: `1px solid ${c.ink150}`,
            bgcolor: 'background.paper',
            px: 3,
            py: 1.25,
            fontSize: 16,
            fontWeight: 500,
            color: c.ink700,
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
        >
          Cancel
        </Box>
        <Box
          component="button"
          type="button"
          onClick={onConfirm}
          disabled={exportingToTable}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'var(--primary-fill)',
            px: 3,
            py: 1.25,
            fontSize: 16,
            fontWeight: 500,
            color: '#fff',
            cursor: 'pointer',
            border: 'none',
            '&:hover': { bgcolor: 'primary.dark' },
            '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
          }}
        >
          {exportingToTable ? <Spinner className="h-4 w-4" /> : null}
          Export
        </Box>
      </DialogActions>
    </Dialog>
  );
}

interface ReceiptActionsProps {
  receipt: ReceiptRecord;
  formValue: EditableReceiptParsedData;
  saving: boolean;
  onApprove: () => Promise<void>;
  onDownload: () => Promise<void>;
}

function useExportToTable({
  receipt,
  formValue,
}: {
  receipt: ReceiptRecord;
  formValue: EditableReceiptParsedData;
}): {
  exportingToTable: boolean;
  exportConfirmOpen: boolean;
  setExportConfirmOpen: (v: boolean) => void;
  handleExportToTable: () => Promise<void>;
} {
  const router = useRouter();
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportingToTable, setExportingToTable] = useState(false);

  const handleExportToTable = async (): Promise<void> => {
    setExportingToTable(true);

    return await (async () => {
      const exportData = buildExportData({ receipt, formValue });
      if (!(exportData.columns.length && exportData.rows.length)) {
        toast.error('There are no parsed receipt fields to export yet');
        return;
      }
      await createExportTable({ receipt, exportData, router });
    })()
      .catch(async () => {
        toast.error('Failed to export to table');
      })
      .finally(async () => {
        setExportingToTable(false);
      });
  };

  return { exportingToTable, exportConfirmOpen, setExportConfirmOpen, handleExportToTable };
}

export function ReceiptActions({
  receipt,
  formValue,
  saving,
  onApprove,
  onDownload,
}: ReceiptActionsProps): React.ReactElement {
  const { exportingToTable, exportConfirmOpen, setExportConfirmOpen, handleExportToTable } =
    useExportToTable({ receipt, formValue });

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <DetailActionButton variant="ghost" type="button" onClick={onDownload}>
          <Download className="h-4 w-4" />
          Download
        </DetailActionButton>
        <DetailActionButton
          variant="ghost"
          type="button"
          onClick={() => setExportConfirmOpen(true)}
          disabled={exportingToTable}
        >
          <Table className="h-4 w-4" />
          Export to table
        </DetailActionButton>
        <DetailActionButton variant="default" type="button" onClick={onApprove} disabled={saving}>
          {saving ? <Spinner className="size-[18px]" /> : null}
          Approve receipt
        </DetailActionButton>
      </Box>
      <ExportConfirmDialog
        open={exportConfirmOpen}
        exportingToTable={exportingToTable}
        onClose={() => setExportConfirmOpen(false)}
        onConfirm={() => {
          setExportConfirmOpen(false);
          void handleExportToTable();
        }}
      />
    </>
  );
}

function ReceiptHeaderTitle({ receipt }: { receipt: ReceiptRecord }): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box>
      <Typography
        style={{
          fontSize: 12,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: c.ink500,
        }}
      >
        Receipt details
      </Typography>
      <Typography
        component="h1"
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: c.ink900,
        }}
      >
        {receipt.subject}
      </Typography>
      <Typography style={{ marginTop: 8, fontSize: 14, color: c.ink700 }}>
        {receipt.source} · {formatStoredDate(receipt.receivedAt)}
      </Typography>
    </Box>
  );
}

interface ReceiptPageHeaderProps {
  receipt: ReceiptRecord;
  formValue: EditableReceiptParsedData;
  saving: boolean;
  onApprove: () => Promise<void>;
  onDownload: () => Promise<void>;
}

export function ReceiptPageHeader({
  receipt,
  formValue,
  saving,
  onApprove,
  onDownload,
}: ReceiptPageHeaderProps): React.ReactElement {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        borderBottom: `1px solid ${c.ink150}`,
        pb: 3,
        alignItems: { sm: 'center' },
        justifyContent: { sm: 'space-between' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          component="button"
          type="button"
          onClick={() => router.back()}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 13,
            fontWeight: 500,
            color: c.ink500,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            p: 0,
            '&:hover': { color: c.ink700 },
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Box>
        <ReceiptHeaderTitle receipt={receipt} />
      </Box>
      <ReceiptActions
        receipt={receipt}
        formValue={formValue}
        saving={saving}
        onApprove={onApprove}
        onDownload={onDownload}
      />
    </Box>
  );
}
