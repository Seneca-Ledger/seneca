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
import { ArrowLeft, CheckCircle2, ChevronDown, Layers, Save, Trash2 } from '@/app/components/icons';
import { NotesPanel } from '@/app/components/notes/NotesPanel';
import { StatementTagsField } from '@/app/components/tags/RecordTagsField';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { flattenStatementCategories, getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { BalanceReviewAlert, balanceReviewLabels } from './components/BalanceReviewAlert';
import { EditStatementSkeleton } from './components/EditStatementSkeleton';
import { EditTransactionsTable } from './components/EditTransactionsTable';
import {
  filterEnabledCategories,
  formatLabel,
  formatNumber as formatNumberHelper,
  isIdEmpty,
  resolveLocale,
} from './editHelpers';
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
    optionsLoading,
    error,
    setError,
    success,
    setSuccess,
    selectedRows,
    setSelectedRows: SetSelectedRows,
    editingRow,
    editedData,
    categories,
    branches,
    wallets,
    bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen,
    statementCategoryDrawerOpen,
    setStatementCategoryDrawerOpen,
    statementCategorySaving,
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
    handleEdit,
    handleFieldChange,
    handleSave,
    handleCancel,
    handleMetadataChange,
    handleResolveParsingWarning,
    handleConvertDroppedSample,
    handleDelete,
    handleBulkUpdate,
    handleBulkDelete,
    handleOpenBulkCategory,
    handleApplyBulkCategory,
    handleStatementCategorySelect,
  } = useStatementEditForm({
    statementId,
    user,
    router,
    messages: {
      loadDataError: t.errors.loadData.value,
      saveTransactionError: t.errors.saveTransaction.value,
      deleteTransactionError: t.errors.deleteTransaction.value,
      updateTransactionsError: t.errors.updateTransactions.value,
      deleteTransactionsError: t.errors.deleteTransactions.value,
      assignCategoryError: t.errors.assignCategory.value,
      exportLoading: t.labels.exportLoading.value,
      exportSuccess: t.labels.exportSuccess.value,
      exportFailure: t.labels.exportFailure.value,
      exportDescription: t.labels.exportDescription.value,
      statementNamePrefix: t.labels.statementNamePrefix.value,
      categoryUpdated: labels.categoryUpdated?.value,
      categoryUpdateFailed: labels.categoryUpdateFailed?.value,
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
  // The drawer ticks the category only when every selected row already shares it.
  const selectedCategoryIds = new Set(
    transactions.filter(row => selectedRows.has(row.id)).map(row => row.categoryId ?? ''),
  );
  const bulkSelectedCategoryId =
    selectedCategoryIds.size === 1 ? ([...selectedCategoryIds][0] ?? '') : '';
  const flattenedStatementCategories = flattenStatementCategories(categories, '', locale);
  const flattenedEnabledStatementCategories = flattenStatementCategories(
    enabledStatementCategories,
    '',
    locale,
  );

  if (loading) {
    return <EditStatementSkeleton />;
  }

  const hasUnconfirmedRows = transactions.some(transaction => transaction.isVerified === false);
  const missingCategoryCount = transactions.filter(transaction => {
    const noCategory = isIdEmpty(transaction.categoryId) && isIdEmpty(transaction.category?.id);
    return noCategory || transaction.category?.isEnabled === false;
  }).length;

  const totalIncome = transactions.reduce((sum, t) => {
    const credit = Number(t.credit);
    return sum + (Number.isNaN(credit) ? 0 : credit);
  }, 0);

  const totalExpense = transactions.reduce((sum, t) => {
    const debit = Number(t.debit);
    return sum + (Number.isNaN(debit) ? 0 : debit);
  }, 0);

  const selectedStatementCategoryName =
    (statement?.category?.name
      ? getCategoryDisplayName(
          {
            name: statement.category.name,
            source: statement.category.source,
            isSystem: statement.category.isSystem,
          },
          locale,
        ).trim()
      : '') ||
    flattenedStatementCategories.find(category => category.id === statement?.categoryId)?.name ||
    labels.categoryButton?.value;
  const hasStatementCategory = !(
    isIdEmpty(statement?.categoryId) && isIdEmpty(statement?.category?.id || undefined)
  );
  const hasDisabledStatementCategory = statement?.category?.isEnabled === false;
  const parsingErrorCount = statement?.parsingDetails?.errors?.length || 0;
  const parsingWarningCount = statement?.parsingDetails?.warnings?.length || 0;
  const hasCategoryIssues =
    !hasStatementCategory || hasDisabledStatementCategory || missingCategoryCount > 0;
  const readinessSeverity: 'success' | 'warning' | 'error' = hasCategoryIssues
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

  if (!hasStatementCategory) {
    readinessDetails.push(labels.alertStatementCategoryMissing?.value);
  }

  if (hasDisabledStatementCategory) {
    readinessDetails.push(labels.alertStatementCategoryDisabled?.value);
  }

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
            {/* A missing category is already called out by the readiness card and the
                "require category" chip, so the button stays neutral beside its siblings
                and only its icon carries the warning colour. */}
            <DetailActionButton
              onClick={() => setStatementCategoryDrawerOpen(true)}
              disabled={statementCategorySaving || optionsLoading}
              title={selectedStatementCategoryName}
              style={{
                minWidth: 0,
                maxWidth: 280,
                justifyContent: 'flex-start',
                padding: '8px 16px',
                fontWeight: 500,
              }}
            >
              {statementCategorySaving ? (
                <Spinner size={18} />
              ) : (
                <Layers size={18} style={{ color: 'var(--text-muted)' }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hasDisabledStatementCategory
                  ? `${selectedStatementCategoryName}${t.labels.disabledSuffix.value}`
                  : selectedStatementCategoryName}
              </span>
            </DetailActionButton>
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
              {labels.confirmAll?.value}
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
          {!hasStatementCategory || hasDisabledStatementCategory ? (
            <Button
              size="small"
              variant="text"
              onClick={() => setStatementCategoryDrawerOpen(true)}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 500 }}
            >
              {labels.chooseCategory?.value}
            </Button>
          ) : null}
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
        <Box sx={{ mb: 2 }}>
          <StatementTagsField statementId={statement.id} />
        </Box>
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

      {/* Summary: the figures in ink, the currency beside them, and the closing
          balance they add up to, checked against the one the bank printed —
          the plainest sign the statement was read right. */}
      <Box
        sx={{
          mb: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {[
          {
            key: 'start',
            label: labels.balanceStart?.value,
            value: openingBalance,
          },
          { key: 'expense', label: labels.expenses?.value, value: safeExpense },
          { key: 'income', label: labels.income?.value, value: safeIncome },
          {
            key: 'end',
            label: labels.closingBalance?.value,
            value: closingBalance,
          },
        ].map(card => (
          <Paper
            key={card.key}
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}
          >
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{card.label}</Typography>
            <Typography
              sx={{ fontSize: 16, fontWeight: 500, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
            >
              {card.value === null ? (
                labels.notSpecified?.value
              ) : (
                <>
                  <PrivateAmount>{formatNumber(card.value)}</PrivateAmount>
                  {statementCurrency ? (
                    <Box
                      component="span"
                      sx={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}
                    >
                      {' '}
                      {statementCurrency}
                    </Box>
                  ) : null}
                </>
              )}
            </Typography>
            {card.key === 'end' && closingBalance !== null && bankClosing !== null ? (
              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: closingMatches ? 'var(--money-up)' : 'var(--attention)',
                  }}
                />
                {closingMatches
                  ? labels.closingMatches?.value
                  : fillTemplateNodes(labels.closingBankSays?.value, {
                      amount: formatNumber(bankClosing),
                    })}
              </Typography>
            ) : null}
          </Paper>
        ))}
      </Box>

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

      <StatementCategoryDrawer
        open={statementCategoryDrawerOpen}
        onClose={() => setStatementCategoryDrawerOpen(false)}
        categories={enabledStatementCategories}
        selectedCategoryId={statement?.categoryId || ''}
        selecting={statementCategorySaving}
        onSelect={categoryId => handleStatementCategorySelect(categoryId)}
        onCreated={category => {
          setStatementCategoryDrawerOpen(false);
          void handleStatementCategorySelect(category.id);
        }}
        clearLabel={labels.categoryAllOption?.value}
      />

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
                variant="contained"
                onClick={handleBulkUpdate}
                disabled={saving}
                startIcon={saving ? <Spinner size={20} /> : <Save size={18} />}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 'none',
                }}
              >
                {labels.save?.value}
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

      {/* Transactions Table */}
      <EditTransactionsTable
        transactions={transactions}
        editingRow={editingRow}
        editedData={editedData}
        selectedRows={selectedRows}
        categories={flattenedEnabledStatementCategories}
        branches={branches}
        wallets={wallets}
        locale={locale}
        formatNumber={formatNumber}
        columns={columns}
        labels={labels}
        onSelectAll={handleSelectAll}
        onRowSelect={handleRowSelect}
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onFieldChange={({ id, field, value }) => handleFieldChange(id, field, value)}
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

      {/* Bulk category: the app's category drawer; a pick applies to every selected row. */}
      <StatementCategoryDrawer
        open={bulkCategoryDialogOpen}
        onClose={() => setBulkCategoryDialogOpen(false)}
        categories={enabledStatementCategories}
        selectedCategoryId={bulkSelectedCategoryId}
        selecting={saving}
        onSelect={categoryId => void handleApplyBulkCategory(categoryId)}
      />
    </Container>
  );
}
