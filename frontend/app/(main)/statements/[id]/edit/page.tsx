'use client';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import Alert from '@mui/material/Alert';
import { useParams, useRouter } from 'next/navigation';
import { buildSourceColumnTitles } from '@/app/(main)/custom-tables/labels';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ArrowLeft, CheckCircle2, ChevronDown, Layers, Trash2 } from '@/app/components/icons';
import { NotesPanel } from '@/app/components/notes/NotesPanel';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { Spinner } from '@/app/components/ui/spinner';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { BalanceReviewAlert, balanceReviewLabels } from './components/BalanceReviewAlert';
import { EditStatementSkeleton } from './components/EditStatementSkeleton';
import { StatementDetailsFields } from './components/StatementDetailsFields';
import { StatementRowsSection } from './components/StatementRowsSection';
import { StatementSummaryCards } from './components/StatementSummaryCards';
import {
  filterEnabledCategories,
  formatLabel,
  formatNumber as formatNumberHelper,
  resolveLocale,
} from './editHelpers';
import { confirmButtonLabel, needsCategory, sharedCategoryId } from './helpers/payee-groups';
import { spreadMessages } from './hooks/category-target';
import { useConfirmStatement } from './hooks/useConfirmStatement';
import { useStatementEditForm } from './hooks/useStatementEditForm';
import { ParsingWarningsPanel } from './ParsingWarningsPanel';
import StatementCategoryDrawer from './StatementCategoryDrawer';

export default function EditStatementPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const t = useIntlayer('statementEditPage');
  const tablesDictionary = useIntlayer('customTablesPage');
  const labels = t.labels as Record<string, { value: string }>;
  const columns = t.columns as Record<string, { value?: string }>;
  const { locale } = useLocale();
  const statementId = params.id as string;

  const {
    statement,
    setStatement: SetStatement,
    transactions,
    setTransactions: SetTransactions,
    loading,
    saving,
    exportingToTable,
    error,
    setError,
    success,
    setSuccess,
    selectedRows,
    setSelectedRows: SetSelectedRows,
    categories,
    bulkCategoryDialogOpen,
    categoryTarget,
    metadataForm,
    setMetadataForm: SetMetadataForm,
    exportConfirmOpen,
    setExportConfirmOpen,
    parsingDetailsExpanded,
    setParsingDetailsExpanded,
    balanceStartInputRef,
    balanceEndInputRef,
    loadData: LoadData,
    handleExportToCustomTable,
    handleRowSelect,
    handleSelectAll,
    handleMetadataChange,
    handleResolveParsingWarning,
    handleConvertDroppedSample,
    handleDelete,
    handleBulkDelete,
    handleOpenBulkCategory,
    handleOpenRowCategory,
    handleOpenRowsCategory,
    handleCloseCategory,
    handleApplyCategory,
  } = useStatementEditForm({
    statementId,
    user,
    router,
    messages: {
      loadDataError: t.errors.loadData.value,
      saveTransactionError: t.errors.saveTransaction.value,
      deleteTransactionError: t.errors.deleteTransaction.value,
      deleteTransactionsError: t.errors.deleteTransactions.value,
      assignCategoryError: t.errors.assignCategory.value,
      exportLoading: t.labels.exportLoading.value,
      exportSuccess: t.labels.exportSuccess.value,
      exportFailure: t.labels.exportFailure.value,
      exportDescription: t.labels.exportDescription.value,
      statementNamePrefix: t.labels.statementNamePrefix.value,
      spread: spreadMessages(labels),
    },
    sourceColumnTitles: buildSourceColumnTitles(tablesDictionary),
  });

  const formatNumber = (num?: number | null): string => formatNumberHelper(num, locale);

  const { confirming, confirmAll } = useConfirmStatement(statementId, LoadData, {
    done: labels.confirmAllDone?.value,
    uncategorized: labels.confirmAllUncategorized?.value,
    failed: labels.confirmAllFailed?.value,
  });

  const enabledStatementCategories = filterEnabledCategories(categories);
  const bulkSelectedCategoryId = sharedCategoryId(
    transactions.filter(row => (categoryTarget?.ids ?? [...selectedRows]).includes(row.id)),
  );
  if (loading) {
    return <EditStatementSkeleton />;
  }

  const hasUnconfirmedRows = transactions.some(transaction => transaction.isVerified === false);
  // The fallback "Uncategorized" counts as no category: it is what the import put there.
  const missingCategoryCount = transactions.filter(
    transaction => needsCategory(transaction) || transaction.category?.isEnabled === false,
  ).length;

  const totalIncome = transactions.reduce((sum, t) => {
    const credit = Number(t.credit);
    return sum + (Number.isNaN(credit) ? 0 : credit);
  }, 0);

  const totalExpense = transactions.reduce((sum, t) => {
    const debit = Number(t.debit);
    return sum + (Number.isNaN(debit) ? 0 : debit);
  }, 0);

  const parsingErrorCount = statement?.parsingDetails?.errors?.length || 0;
  const parsingWarningCount = statement?.parsingDetails?.warnings?.length || 0;
  const readinessSeverity: 'success' | 'warning' | 'error' =
    missingCategoryCount > 0
      ? 'error'
      : parsingErrorCount > 0 || parsingWarningCount > 0
        ? 'warning'
        : 'success';

  const readinessTitle =
    readinessSeverity === 'error'
      ? labels.alertNeedsFixTitle?.value
      : readinessSeverity === 'warning'
        ? labels.alertReviewTitle?.value
        : labels.alertReadyTitle?.value;

  const readinessDetails: string[] = [];

  if (missingCategoryCount > 0) {
    readinessDetails.push(
      labels.alertTransactionsCategoryMissing.value.replace(
        '{count}',
        String(missingCategoryCount),
      ),
    );
  }

  if (parsingErrorCount > 0) {
    readinessDetails.push(
      labels.alertParsingErrors.value.replace('{count}', String(parsingErrorCount)),
    );
  }

  if (parsingWarningCount > 0) {
    readinessDetails.push(
      labels.alertParsingWarnings.value.replace('{count}', String(parsingWarningCount)),
    );
  }

  if (!transactions.length) {
    readinessDetails.push(labels.alertNoTransactions?.value);
  }

  const readinessMessage =
    readinessDetails.length > 0 ? readinessDetails.join(' · ') : labels.alertReadyBody?.value;

  const readinessInlineText = `${readinessTitle}: ${readinessMessage}`;

  const statementCurrency =
    transactions.find(transaction => transaction.currency)?.currency ??
    statement?.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay ??
    null;
  const toAmount = (value: unknown): number | null =>
    value === null || value === undefined || value === '' || Number.isNaN(Number(value))
      ? null
      : Number(value);
  const openingBalance = toAmount(statement?.balanceStart);
  const safeExpense = !Number.isNaN(totalExpense) && totalExpense >= 0 ? totalExpense : 0;
  const safeIncome = !Number.isNaN(totalIncome) && totalIncome >= 0 ? totalIncome : 0;
  const closingBalance =
    openingBalance === null
      ? null
      : Math.round((openingBalance - safeExpense + safeIncome) * 100) / 100;
  const bankClosing = toAmount(statement?.balanceEnd);
  const closingMatches =
    closingBalance !== null &&
    bankClosing !== null &&
    Math.abs(closingBalance - bankClosing) < 0.01;

  return (
    <Container
      maxWidth={false}
      sx={{ py: 5, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
    >
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.back()}
          sx={{
            mb: 3,
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {t.labels.back}
        </Button>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 240 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 500,
                mb: 0.5,
                color: 'text.primary',
                letterSpacing: '-0.02em',
              }}
            >
              {statement?.fileName}
            </Typography>
            {/* Period, size and currency in one quiet line: no chip, no fourth card. */}
            <Typography
              data-testid="statement-transactions-chip"
              sx={{ fontSize: 14, color: 'var(--text-muted)' }}
            >
              {[
                statement?.statementDateFrom && statement?.statementDateTo
                  ? `${formatStoredDate(statement.statementDateFrom)} – ${formatStoredDate(statement.statementDateTo)}`
                  : null,
                `${statement?.totalTransactions} ${t.labels.transactionsCount.value}`,
                statementCurrency,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <DetailActionButton
              onClick={() => setExportConfirmOpen(true)}
              disabled={exportingToTable || !transactions.length}
            >
              {exportingToTable ? <Spinner size={18} /> : null}
              {t.labels.exportButton.value}
            </DetailActionButton>
            {/* The page's main action: outlined until it can be pressed, then filled. */}
            <DetailActionButton
              variant={confirming || !hasUnconfirmedRows ? 'outline' : 'default'}
              onClick={() => void confirmAll()}
              disabled={confirming || !hasUnconfirmedRows}
            >
              {confirming ? <Spinner size={18} /> : <CheckCircle2 size={18} />}
              {confirmButtonLabel(transactions, labels)}
            </DetailActionButton>
          </Box>
        </Box>
      </Box>

      {/* What is left before this statement can go in: a quiet panel with an
          ochre dot, and the fix right in it. Not an error banner: a missing
          category blocks nothing yet. */}
      {readinessSeverity !== 'success' ? (
        <Box
          role="status"
          sx={{
            mb: 3,
            px: 2,
            py: 1,
            minHeight: 42,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            borderRadius: 1.5,
            bgcolor: 'var(--surface-soft)',
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: 'var(--attention)',
              flexShrink: 0,
            }}
          />
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 0,
              lineHeight: 1.35,
              color: 'var(--foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={readinessInlineText}
          >
            <Box component="span" sx={{ fontWeight: 500 }}>
              {readinessTitle}
            </Box>
            {`: ${readinessMessage}`}
          </Typography>
        </Box>
      ) : null}

      {statement && (
        <BalanceReviewAlert
          statement={statement}
          status={statement.status}
          parsingDetails={statement.parsingDetails}
          formatNumber={formatNumber}
          onConfirmed={LoadData}
          labels={balanceReviewLabels(labels)}
        />
      )}

      {statement ? (
        <StatementDetailsFields statement={statement} onAccountChanged={LoadData} />
      ) : null}

      {/* Alerts */}
      {error && (
        <Alert variant="filled" severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="filled" severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          {t.labels.changesSaved}
        </Alert>
      )}

      <StatementSummaryCards
        opening={openingBalance}
        expense={safeExpense}
        income={safeIncome}
        closing={closingBalance}
        bankClosing={bankClosing}
        closingMatches={closingMatches}
        currency={statementCurrency}
        formatNumber={formatNumber}
        labels={labels}
      />

      {/* Editing & Parsing Details Accordion */}
      <Accordion
        expanded={
          parsingDetailsExpanded ??
          (parsingErrorCount > 0 ||
            parsingWarningCount > 0 ||
            (statement?.parsingDetails?.droppedSamples?.length ?? 0) > 0)
        }
        onChange={(_, expanded) => setParsingDetailsExpanded(expanded)}
        elevation={0}
        disableGutters
        sx={{
          mb: 4,
          bgcolor: 'transparent',
          '&:before': { display: 'none' },
          overflow: 'hidden',
        }}
      >
        {/* A text link that opens the details, not a full-width card of its own. */}
        <AccordionSummary
          expandIcon={<ChevronDown size={16} />}
          sx={{
            px: 0,
            minHeight: 0,
            justifyContent: 'flex-start',
            '& .MuiAccordionSummary-content': { flexGrow: 0, my: 0.5 },
            '& .MuiAccordionSummary-expandIconWrapper': { color: 'var(--primary)', ml: 0.5 },
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'var(--primary)' }}>
            {t.labels.parsingDetails?.value}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: '1fr 1fr 1fr 1fr',
              },
              gap: 3,
              mb: statement?.parsingDetails ? 3 : 0,
            }}
          >
            <CustomDatePicker
              containerTestId="statement-metadata-field-start-date"
              label={labels.startDate?.value}
              value={metadataForm.statementDateFrom}
              onChange={value => handleMetadataChange('statementDateFrom', value)}
              helperText={
                statement?.parsingDetails?.metadataExtracted?.dateFrom
                  ? `${labels.fromFilePrefix?.value}${formatStoredDate(statement.parsingDetails.metadataExtracted.dateFrom, resolveLocale(locale))}`
                  : undefined
              }
            />
            <CustomDatePicker
              containerTestId="statement-metadata-field-end-date"
              label={labels.endDate?.value}
              value={metadataForm.statementDateTo}
              onChange={value => handleMetadataChange('statementDateTo', value)}
              helperText={
                statement?.parsingDetails?.metadataExtracted?.dateTo
                  ? `${labels.fromFilePrefix?.value}${formatStoredDate(statement.parsingDetails.metadataExtracted.dateTo, resolveLocale(locale))}`
                  : undefined
              }
            />
            <div data-testid="statement-metadata-field-opening-balance">
              <TextField
                type="number"
                fullWidth
                size="small"
                label={labels.openingBalance?.value}
                inputRef={balanceStartInputRef}
                value={metadataForm.balanceStart}
                onChange={e => handleMetadataChange('balanceStart', e.target.value)}
                placeholder="0.00"
                helperText={
                  statement?.parsingDetails?.metadataExtracted?.balanceStart
                    ? `${labels.fromFilePrefix?.value}${formatNumber(statement.parsingDetails.metadataExtracted.balanceStart)}`
                    : labels.enterOpeningBalance?.value
                }
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            </div>
            <div data-testid="statement-metadata-field-closing-balance">
              <TextField
                type="number"
                fullWidth
                size="small"
                label={labels.balanceEnd?.value}
                inputRef={balanceEndInputRef}
                value={metadataForm.balanceEnd}
                onChange={e => handleMetadataChange('balanceEnd', e.target.value)}
                placeholder="0.00"
                helperText={
                  statement?.parsingDetails?.metadataExtracted?.balanceEnd
                    ? `${labels.fromFilePrefix?.value}${formatNumber(statement.parsingDetails.metadataExtracted.balanceEnd)}`
                    : labels.enterManuallyHint?.value
                }
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            </div>
          </Box>

          {statement?.parsingDetails && (
            <>
              <Divider sx={{ mb: 3 }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  mb: 2,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {labels.extractedMetadata?.value}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr 1fr',
                    sm: 'repeat(3, 1fr)',
                    md: 'repeat(6, 1fr)',
                  },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {labels.bank?.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {statement.parsingDetails.detectedBank || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {labels.bankDetectedBy?.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {statement.parsingDetails.detectedBy || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {labels.format?.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {statement.parsingDetails.detectedFormat?.toUpperCase() || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {labels.foundTransactions?.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {statement.parsingDetails.transactionsFound ?? '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {labels.createdTransactions?.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {statement.parsingDetails.transactionsCreated ?? '—'}
                  </Typography>
                </Box>
                {statement.parsingDetails.errors && statement.parsingDetails.errors.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="error">
                      {labels.errors?.value}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>
                      {statement.parsingDetails.errors.length}
                    </Typography>
                  </Box>
                )}
                {statement.parsingDetails.warnings &&
                  statement.parsingDetails.warnings.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'warning.main',
                        }}
                      >
                        {labels.warnings?.value}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'warning.main' }}>
                        {statement.parsingDetails.warnings.length}
                      </Typography>
                    </Box>
                  )}
                {statement.parsingDetails.otherBankMentions &&
                  statement.parsingDetails.otherBankMentions.length > 0 && (
                    <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {labels.otherBankMentions?.value}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {statement.parsingDetails.otherBankMentions.join(', ')}
                      </Typography>
                    </Box>
                  )}
              </Box>

              {(statement.parsingDetails.warnings?.length || 0) > 0 ||
              (statement.parsingDetails.droppedSamples?.length || 0) > 0 ? (
                <ParsingWarningsPanel
                  warnings={statement.parsingDetails.warnings || []}
                  droppedSamples={statement.parsingDetails.droppedSamples || []}
                  onConvertDroppedSample={({ sample, index, warning }) =>
                    handleConvertDroppedSample(sample, index, warning)
                  }
                  onResolveWarning={({ warning }) => handleResolveParsingWarning(warning)}
                  fixTooltipLabel={labels.fixDroppedRow?.value}
                  resolveBalanceTooltipLabel={labels.balanceEnd?.value}
                  title={labels.warnings?.value}
                  helperText={labels.alertParsingWarnings?.value?.replace(
                    '{count}',
                    String(statement.parsingDetails.warnings?.length || 0),
                  )}
                />
              ) : null}
            </>
          )}
        </AccordionDetails>
      </Accordion>

      <Dialog
        open={exportConfirmOpen}
        onClose={() => setExportConfirmOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 22, fontWeight: 600 }}>
          {t.labels.exportConfirmTitle.value}
        </DialogTitle>
        <DialogContent dividers>
          <p style={{ fontSize: 16, lineHeight: 2, color: 'var(--foreground)' }}>
            {t.labels.exportConfirmBody.value}
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 4, py: 3, gap: 1.5, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setExportConfirmOpen(false)}
            style={{
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              padding: '10px 24px',
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t.labels.cancel.value}
          </button>
          <button
            type="button"
            onClick={() => {
              setExportConfirmOpen(false);
              void handleExportToCustomTable();
            }}
            disabled={exportingToTable || !transactions.length}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: tokens.radius.md,
              background: 'var(--primary-fill)',
              padding: '10px 24px',
              fontSize: 16,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {exportingToTable ? <Spinner style={{ height: 16, width: 16, color: '#fff' }} /> : null}
            {t.labels.exportConfirmConfirm.value}
          </button>
        </DialogActions>
      </Dialog>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 3,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: 'primary.700',
                fontSize: '0.9375rem',
              }}
            >
              {formatLabel(labels.selectedTransactions?.value, { count: selectedRows.size }) ||
                `Selected: ${selectedRows.size} transactions`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                onClick={handleOpenBulkCategory}
                startIcon={<Layers size={18} />}
                disabled={saving}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: 'primary.300',
                  color: 'primary.700',
                  '&:hover': {
                    borderColor: 'primary.400',
                    bgcolor: 'primary.100',
                  },
                }}
              >
                {labels.assignCategory?.value}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() =>
                  handleBulkDelete(
                    formatLabel(labels.confirmDeleteMany?.value, { count: selectedRows.size }) ||
                      `Delete ${selectedRows.size} transactions?`,
                  )
                }
                disabled={saving}
                startIcon={<Trash2 size={18} />}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                }}
              >
                {labels.delete?.value}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      <StatementRowsSection
        transactions={transactions}
        selectedRows={selectedRows}
        locale={locale}
        formatNumber={formatNumber}
        columns={columns}
        labels={labels}
        onSelectAll={handleSelectAll}
        onRowSelect={handleRowSelect}
        onCategoryClick={handleOpenRowCategory}
        onDelete={handleDelete}
        onPickRows={handleOpenRowsCategory}
      />

      {statement && (
        <div
          style={{
            marginTop: 24,
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--card-bg)',
            padding: 20,
          }}
        >
          <NotesPanel entityType="statement" entityId={statement.id} />
        </div>
      )}

      {/* The app's category drawer: opened from a row's category it sets that row,
          from the bulk bar every selected row. */}
      <StatementCategoryDrawer
        open={bulkCategoryDialogOpen}
        onClose={handleCloseCategory}
        categories={enabledStatementCategories}
        selectedCategoryId={bulkSelectedCategoryId}
        selecting={saving}
        onSelect={categoryId => void handleApplyCategory(categoryId)}
      />
    </Container>
  );
}
