'use client';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  MenuItem,
  Modal,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useId } from 'react';

import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { AuditEventDrawer } from '@/app/audit/components/AuditEventDrawer';
import { EntityHistoryTimeline } from '@/app/audit/components/EntityHistoryTimeline';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { CheckCircle2, ChevronDown } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { AuditEvent } from '@/lib/api/audit';
import type {
  EditableLineItem,
  EditableReceiptData,
  GmailReceipt,
  ReceiptCategoryOption,
} from '../hooks/useGmailReceiptData';

interface ParsedMetadataFieldProps {
  label: string;
  value: React.ReactNode;
  color?: string;
}

function ParsedMetadataField({
  label,
  value,
  color,
}: ParsedMetadataFieldProps): React.ReactElement {
  return (
    <Box>
      <Typography variant="caption" color={color || 'text.secondary'}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, color: color ? `${color}.main` : undefined }}
      >
        {value}
      </Typography>
    </Box>
  );
}

interface GmailReceiptDetailsProps {
  receipt: GmailReceipt;
  potentialDuplicates: GmailReceipt[];
  editedData: EditableReceiptData;
  lineItems: EditableLineItem[];
  categories: ReceiptCategoryOption[];
  enabledCategories: ReceiptCategoryOption[];
  selectedCategoryId: string;
  isLowConfidence: boolean;
  confidencePercent: number | null;
  warningCount: number;
  currency: string;
  historyEvents: AuditEvent[];
  historyLoading: boolean;
  selectedHistoryEvent: AuditEvent | null;
  historyDrawerOpen: boolean;
  categoryDrawerOpen: boolean;
  categorySaving: boolean;
  bulkCategoryDialogOpen: boolean;
  bulkCategoryId: string;
  onMarkDuplicate: (id: string) => Promise<void>;
  onUnmarkDuplicate: () => Promise<void>;
  onHistorySelect: (event: AuditEvent) => void;
  onHistoryDrawerClose: () => void;
  onCategorySelect: (id: string) => Promise<void>;
  onCategoryDrawerClose: () => void;
  onBulkCategoryClose: () => void;
  onBulkCategoryIdChange: (id: string) => void;
  onApplyBulkCategory: () => void;
  setEditedData: React.Dispatch<React.SetStateAction<EditableReceiptData>>;
  setShowPreview: (show: boolean) => void;
}

export function GmailReceiptDetails({
  receipt,
  potentialDuplicates,
  editedData,
  enabledCategories,
  selectedCategoryId,
  isLowConfidence,
  confidencePercent,
  warningCount,
  currency,
  historyEvents,
  historyLoading,
  selectedHistoryEvent,
  historyDrawerOpen,
  categoryDrawerOpen,
  categorySaving,
  onMarkDuplicate,
  onUnmarkDuplicate,
  onHistorySelect,
  onHistoryDrawerClose,
  onCategorySelect,
  onCategoryDrawerClose,
  setEditedData,
  setShowPreview,
}: GmailReceiptDetailsProps): React.ReactElement {
  const t = useIntlayer('gmailReceiptPage');
  return (
    <>
      <Accordion
        elevation={0}
        sx={{
          mb: 4,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' },
          overflow: 'hidden',
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} />}
          sx={{
            bgcolor: theme =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {t.details.title}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
              gap: 3,
              mb: 3,
            }}
          >
            <TextField
              label={t.details.vendorMerchant.value}
              size="small"
              fullWidth
              value={editedData.vendor || ''}
              onChange={e => setEditedData(prev => ({ ...prev, vendor: e.target.value }))}
              sx={{
                '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
              }}
            />
            <CustomDatePicker
              label={t.details.date.value}
              value={editedData.date ? editedData.date.split('T')[0] : ''}
              onChange={value => setEditedData(prev => ({ ...prev, date: value }))}
            />
            <TextField
              label={t.details.currency.value}
              size="small"
              fullWidth
              value={editedData.currency || ''}
              onChange={e => setEditedData(prev => ({ ...prev, currency: e.target.value }))}
              sx={{
                '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
              }}
            />
            <TextField
              label={t.details.category.value}
              size="small"
              fullWidth
              select
              value={selectedCategoryId}
              onChange={e => {
                const selected = enabledCategories.find(c => c.id === e.target.value);
                setEditedData(prev => ({
                  ...prev,
                  categoryId: e.target.value,
                  category: selected?.name,
                }));
              }}
              sx={{
                '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
              }}
            >
              <MenuItem value="">{t.details.selectCategory}</MenuItem>
              {enabledCategories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
              gap: 2,
            }}
          >
            <ParsedMetadataField label={t.details.from.value} value={receipt.sender || '—'} />
            <ParsedMetadataField
              label={t.details.transactionType.value}
              value={receipt.parsedData?.transactionType || '—'}
            />
            <ParsedMetadataField
              label={t.details.tax.value}
              value={
                editedData.tax !== undefined && editedData.tax !== null
                  ? `${editedData.tax} ${currency}`
                  : '—'
              }
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t.details.confidence}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, color: isLowConfidence ? 'warning.main' : 'text.primary' }}
              >
                {confidencePercent === null ? '—' : `${confidencePercent}%`}
              </Typography>
            </Box>
            {warningCount > 0 && (
              <ParsedMetadataField
                label={t.details.parsingWarnings.value}
                value={warningCount}
                color="warning"
              />
            )}
            {receipt.isDuplicate && (
              <ParsedMetadataField
                label={t.details.duplicate.value}
                value={t.details.yes.value}
                color="error"
              />
            )}
          </Box>

          {(receipt.parsedData?.validationIssues || []).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="caption"
                color="warning.main"
                sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase' }}
              >
                {t.details.validationIssues}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {receipt.parsedData?.validationIssues?.map(issue => (
                  <Typography
                    key={issue}
                    variant="body2"
                    sx={{ color: 'warning.dark', fontSize: '0.8125rem' }}
                  >
                    · {issue}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {(receipt.metadata?.attachments || []).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase' }}
              >
                {t.details.attachments}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {receipt.metadata?.attachments?.map(attachment => (
                  <Box
                    key={`${attachment.filename}-${attachment.size}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: theme =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {attachment.filename}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setShowPreview(true)}
                      sx={{ textTransform: 'none', fontWeight: 600, color: 'primary.main' }}
                    >
                      {t.details.preview}
                    </Button>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {potentialDuplicates.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="caption"
                color="warning.main"
                sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase' }}
              >
                {t.details.potentialDuplicates.value.replace(
                  '{count}',
                  String(potentialDuplicates.length),
                )}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {potentialDuplicates.map(dup => (
                  <Paper
                    key={dup.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'warning.200',
                      bgcolor: 'warning.50',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.900' }}>
                      {dup.parsedData?.vendor || dup.sender}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'warning.800' }}>
                      {formatStoredDate(dup.parsedData?.date || dup.receivedAt)} ·{' '}
                      {(dup.parsedData?.amount || 0).toLocaleString()}{' '}
                      {dup.parsedData?.currency || FALLBACK_CURRENCY}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onMarkDuplicate(dup.id)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderColor: 'warning.400',
                          color: 'warning.800',
                          '&:hover': { bgcolor: 'warning.100' },
                        }}
                      >
                        {t.details.markAsDuplicate}
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {receipt.isDuplicate && receipt.duplicateOfId && (
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={onUnmarkDuplicate}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {t.details.unmarkAsDuplicate}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase' }}
            >
              {t.details.history}
            </Typography>
            {historyLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <Spinner className="h-4 w-4 text-inherit" />
                <Typography variant="body2">{t.details.loadingHistory}</Typography>
              </Box>
            ) : (
              <EntityHistoryTimeline
                events={historyEvents}
                onSelect={event => {
                  onHistorySelect(event);
                }}
              />
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <AuditEventDrawer
        event={selectedHistoryEvent}
        open={historyDrawerOpen}
        onClose={onHistoryDrawerClose}
      />

      <StatementCategoryDrawer
        open={categoryDrawerOpen}
        onClose={onCategoryDrawerClose}
        categories={enabledCategories}
        selectedCategoryId={selectedCategoryId}
        selecting={categorySaving}
        onSelect={onCategorySelect}
        labels={{
          title: t.categoryDrawer.title.value,
          searchPlaceholder: t.categoryDrawer.searchPlaceholder.value,
          allOption: t.categoryDrawer.notSelected.value,
          noResults: t.categoryDrawer.noResults.value,
        }}
        width="sm"
        showAllOption
      />
    </>
  );
}

interface BulkCategoryDialogProps {
  open: boolean;
  selectedRowsSize: number;
  bulkCategoryId: string;
  enabledCategories: ReceiptCategoryOption[];
  onClose: () => void;
  onCategoryChange: (id: string) => void;
  onApply: () => void;
}

export function BulkCategoryDialog({
  open,
  selectedRowsSize,
  bulkCategoryId,
  enabledCategories,
  onClose,
  onCategoryChange,
  onApply,
}: BulkCategoryDialogProps): React.ReactElement {
  const titleId = useId();
  const t = useIntlayer('gmailReceiptPage');
  // Modal traps focus inside, closes on Escape and restores focus on close.
  return (
    <Modal open={open} onClose={onClose} hideBackdrop>
      <Box
        tabIndex={-1}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: 'rgba(0,0,0,0.5)',
          outline: 'none',
        }}
        onClick={onClose}
      >
        <Box
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            bgcolor: 'background.paper',
            p: 3,
            minWidth: 360,
            maxWidth: 480,
            border: '1px solid',
            borderColor: 'grey.200',
          }}
          onClick={e => e.stopPropagation()}
        >
          <Typography
            id={titleId}
            sx={{
              fontWeight: 600,
              fontSize: '1rem',
              color: 'text.primary',
              letterSpacing: '-0.01em',
              pb: 1,
            }}
          >
            {t.bulk.title.value.replace('{count}', String(selectedRowsSize))}
          </Typography>
          <Box sx={{ pt: 3 }}>
            <TextField
              select
              label={t.bulk.category.value}
              fullWidth
              value={bulkCategoryId}
              onChange={e => onCategoryChange(e.target.value)}
              helperText={t.bulk.helper.value}
              sx={{
                '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
              }}
            >
              <MenuItem value="">{t.bulk.notSelected}</MenuItem>
              {enabledCategories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 3 }}>
            <Button
              onClick={onClose}
              sx={{ textTransform: 'none', fontWeight: 500, color: 'text.secondary' }}
            >
              {t.bulk.cancel}
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircle2 size={18} />}
              onClick={onApply}
              disabled={!bulkCategoryId}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {t.bulk.apply}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
