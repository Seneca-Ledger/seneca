'use client';

import { Box, Button, Container, Paper, Typography } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { CreatePayableDrawer } from '@/app/(main)/statements/components/payables/CreatePayableDrawer';
import { ArrowLeft } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import {
  getFinancialDocumentStatusLabel,
  toFinancialDocumentStatus,
} from '@/app/lib/financial-document';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import { GmailReceiptDetails } from './components/GmailReceiptDuplicates';
import { GmailReceiptHeader } from './components/GmailReceiptHeader';
import { GmailReceiptLineItems } from './components/GmailReceiptLineItems';
import { SummaryMetrics } from './components/SummaryMetrics';
import {
  type UseGmailReceiptActionsReturn,
  useGmailReceiptActions,
} from './hooks/useGmailReceiptActions';
import type { GmailReceipt } from './hooks/useGmailReceiptData';
import { type UseGmailReceiptDataReturn, useGmailReceiptData } from './hooks/useGmailReceiptData';
import { buildPayablePrefillFromReceipt } from './payable-prefill';

interface PageContentProps {
  data: Omit<UseGmailReceiptDataReturn, 'receipt'> & { receipt: GmailReceipt };
  actions: UseGmailReceiptActionsReturn;
  receiptId: string;
}

interface BulkCategoryState {
  open: boolean;
  id: string;
  setOpen: (v: boolean) => void;
  setId: (v: string) => void;
}

function ReceiptModals({
  data,
  actions,
  receiptId,
  payablePrefill,
}: PageContentProps & {
  payablePrefill: ReturnType<typeof buildPayablePrefillFromReceipt>;
}): React.JSX.Element {
  const t = useIntlayer('gmailReceiptPage');
  return (
    <>
      <StatementCategoryDrawer
        open={actions.categoryDrawerOpen}
        onClose={() => actions.setCategoryDrawerOpen(false)}
        categories={data.enabledCategories}
        selectedCategoryId={data.selectedCategoryId}
        selecting={actions.categorySaving}
        onSelect={actions.handleCategorySelect}
        labels={{
          title: t.categoryDrawer.title.value,
          searchPlaceholder: t.categoryDrawer.searchPlaceholder.value,
          allOption: t.categoryDrawer.notSelected.value,
          noResults: t.categoryDrawer.noResults.value,
        }}
        width="sm"
        showAllOption
      />
      <CreatePayableDrawer
        open={actions.payableDrawerOpen}
        payable={null}
        initialValues={payablePrefill}
        saving={false}
        onClose={() => actions.setPayableDrawerOpen(false)}
        onSubmit={actions.handleCreatePayable}
        labels={{
          createTitle: t.payable.createTitle.value,
          editTitle: t.payable.editTitle.value,
          vendor: t.payable.vendor.value,
          amount: t.payable.amount.value,
          currency: t.payable.currency.value,
          dueDate: t.payable.dueDate.value,
          source: t.payable.source.value,
          status: t.payable.status.value,
          comment: t.payable.comment.value,
          save: t.payable.continue.value,
          saving: t.payable.saving.value,
          cancel: t.payable.cancel.value,
          sourceOptions: {
            manual: t.payable.sourceManual.value,
            invoice: t.payable.sourceInvoice.value,
            statement: t.payable.sourceStatement.value,
          },
          statusOptions: {
            to_pay: t.payable.statusToPay.value,
            scheduled: t.payable.statusScheduled.value,
            paid: t.payable.statusPaid.value,
            overdue: t.payable.statusOverdue.value,
            archived: t.payable.statusArchived.value,
          },
        }}
      />
      {actions.showPreview && (
        <ReceiptPreviewModal receiptId={receiptId} onClose={() => actions.setShowPreview(false)} />
      )}
    </>
  );
}

function ReceiptPageContent({
  data,
  actions,
  receiptId,
  bulk,
}: PageContentProps & { bulk: BulkCategoryState }): React.JSX.Element {
  const payablePrefill = useMemo(
    () =>
      data.receipt
        ? buildPayablePrefillFromReceipt({ receipt: data.receipt, editedData: data.editedData })
        : null,
    [data.receipt, data.editedData],
  );
  const statusLabel = getFinancialDocumentStatusLabel(
    toFinancialDocumentStatus(data.receipt?.status),
  );
  const handleOpenPayable = (): void => {
    if (payablePrefill) {
      actions.setPayableDrawerOpen(true);
    }
  };
  const handleApplyBulkCategory = (): void => {
    if (!bulk.id) {
      return;
    }
    const sel = data.categories.find(c => c.id === bulk.id);
    data.setEditedData(prev => ({ ...prev, categoryId: bulk.id, category: sel?.name }));
    bulk.setOpen(false);
    bulk.setId('');
  };

  return (
    <Container
      maxWidth={false}
      sx={{ py: 5, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
    >
      <GmailReceiptHeader
        receipt={data.receipt}
        statusLabel={statusLabel}
        lineItemsCount={Math.max(1, data.lineItems.length)}
        hasCategoryIssues={data.hasCategoryIssues}
        hasCategory={data.hasCategory}
        hasDisabledCategory={data.hasDisabledCategory}
        selectedCategory={data.selectedCategory}
        canSubmit={data.canSubmit}
        submitting={actions.submitting}
        exporting={actions.exporting}
        gmailMessageLink={data.gmailMessageLink}
        readinessSeverity={data.readinessSeverity}
        readinessInlineText={data.readinessInlineText}
        onOpenCategory={() => actions.setCategoryDrawerOpen(true)}
        onSubmit={actions.handleSubmitDocument}
        onOpenPayable={handleOpenPayable}
        onExportToGmailDraft={actions.handleExportToGmailDraft}
        onExportToXlsx={actions.handleExportToXlsx}
      />
      <SummaryMetrics
        editedData={data.editedData}
        receipt={data.receipt}
        income={data.income}
        expense={data.expense}
        currency={data.currency}
        confidencePercent={data.confidencePercent}
        isLowConfidence={data.isLowConfidence}
      />
      <GmailReceiptDetails
        receipt={data.receipt}
        potentialDuplicates={data.potentialDuplicates}
        editedData={data.editedData}
        lineItems={data.lineItems}
        categories={data.categories}
        enabledCategories={data.enabledCategories}
        selectedCategoryId={data.selectedCategoryId}
        isLowConfidence={data.isLowConfidence}
        confidencePercent={data.confidencePercent}
        warningCount={data.warningCount}
        currency={data.currency}
        historyEvents={data.historyEvents}
        historyLoading={data.historyLoading}
        selectedHistoryEvent={data.selectedHistoryEvent}
        historyDrawerOpen={data.historyDrawerOpen}
        categoryDrawerOpen={actions.categoryDrawerOpen}
        categorySaving={actions.categorySaving}
        bulkCategoryDialogOpen={bulk.open}
        bulkCategoryId={bulk.id}
        onMarkDuplicate={actions.handleMarkDuplicate}
        onUnmarkDuplicate={actions.handleUnmarkDuplicate}
        onHistorySelect={event => {
          data.setSelectedHistoryEvent(event);
          data.setHistoryDrawerOpen(true);
        }}
        onHistoryDrawerClose={() => data.setHistoryDrawerOpen(false)}
        onCategorySelect={actions.handleCategorySelect}
        onCategoryDrawerClose={() => actions.setCategoryDrawerOpen(false)}
        onBulkCategoryClose={() => bulk.setOpen(false)}
        onBulkCategoryIdChange={bulk.setId}
        onApplyBulkCategory={handleApplyBulkCategory}
        setEditedData={data.setEditedData}
        setShowPreview={actions.setShowPreview}
      />
      <GmailReceiptLineItems
        lineItems={data.lineItems}
        editedData={data.editedData}
        enabledCategories={data.enabledCategories}
        selectedCategoryId={data.selectedCategoryId}
        hasCategory={data.hasCategory}
        isLowConfidence={data.isLowConfidence}
        transactionType={data.transactionType}
        currency={data.currency}
        saving={actions.saving}
        onSaveChanges={actions.handleSaveChanges}
        setEditedData={data.setEditedData}
        onOpenBulkCategory={() => bulk.setOpen(true)}
      />
      <ReceiptModals
        data={data}
        actions={actions}
        receiptId={receiptId}
        payablePrefill={payablePrefill}
      />
    </Container>
  );
}

function GmailReceiptSkeleton(): React.JSX.Element {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={280} height={32} />
          <Skeleton variant="text" width={180} height={20} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Skeleton variant="rounded" width={100} height={36} />
          <Skeleton variant="rounded" width={130} height={36} />
          <Skeleton variant="rounded" width={130} height={36} />
        </Box>
      </Box>

      <Box
        sx={{
          mb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 2,
        }}
      >
        {[0, 1, 2, 3].map(idx => (
          <Paper
            key={idx}
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'grey.200', p: 2 }}
          >
            <Skeleton variant="text" width={60} height={16} />
            <Skeleton variant="text" width={90} height={22} />
          </Paper>
        ))}
      </Box>

      <Skeleton variant="rectangular" width="100%" height={320} />
    </Container>
  );
}

export default function GmailReceiptDocumentPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const receiptId = params.id;
  const router = useRouter();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkId, setBulkId] = useState('');
  const t = useIntlayer('gmailReceiptPage');

  const data = useGmailReceiptData({ receiptId });
  const actions = useGmailReceiptActions({
    receiptId,
    receipt: data.receipt,
    editedData: data.editedData,
    categories: data.categories,
    setReceipt: data.setReceipt,
    setPotentialDuplicates: data.setPotentialDuplicates,
    setEditedData: data.setEditedData,
  });

  if (data.loading) {
    return <GmailReceiptSkeleton />;
  }
  if (!data.receipt) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper elevation={0} sx={{ p: 6, border: '1px solid', borderColor: 'grey.200' }}>
          <Typography variant="body1" fontWeight={600}>
            {t.page.notFound}
          </Typography>
          <Button
            startIcon={<ArrowLeft size={18} />}
            onClick={() => router.push('/statements')}
            sx={{ mt: 2, textTransform: 'none' }}
          >
            {t.page.backToReceipts}
          </Button>
        </Paper>
      </Container>
    );
  }

  const bulk: BulkCategoryState = {
    open: bulkOpen,
    id: bulkId,
    setOpen: setBulkOpen,
    setId: setBulkId,
  };
  const safeData = data as Omit<UseGmailReceiptDataReturn, 'receipt'> & { receipt: GmailReceipt };
  return <ReceiptPageContent data={safeData} actions={actions} receiptId={receiptId} bulk={bulk} />;
}
