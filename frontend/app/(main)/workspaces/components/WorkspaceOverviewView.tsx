'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronLeft, ImageIcon, Save, Trash2 } from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
} from '@/app/lib/statement-expense-drawer';
import { tokens } from '@/lib/theme-tokens';
import { AVAILABLE_BACKGROUNDS } from '../constants';
import { BackgroundSelector } from './BackgroundSelector';
import { BusinessProfileSection } from './BusinessProfileSection';
import { InvoiceSettingsSection } from './InvoiceSettingsSection';
import { SettingsSection } from './SettingsSection';
import { TaxJurisdictionSection } from './TaxJurisdictionSection';
import { TaxRulesSection } from './TaxRulesSection';

const resolveBackgroundSrc = (backgroundImage: string | null) => {
  if (!backgroundImage) {
    return null;
  }

  if (
    backgroundImage.startsWith('http://') ||
    backgroundImage.startsWith('https://') ||
    backgroundImage.startsWith('/')
  ) {
    return backgroundImage;
  }

  return `/workspace-backgrounds/${backgroundImage}`;
};

/** Inputs are outlined, not filled: a hole cut into the page reads heavier than a line. */
const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'transparent',
  padding: '9px 12px',
  fontSize: 14,
  // A textarea does not inherit the page font on its own; it fell back to monospace.
  fontFamily: 'inherit',
  color: 'var(--foreground)',
  borderRadius: tokens.radius.sm,
  boxSizing: 'border-box',
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 6,
};

export default function WorkspaceOverviewView() {
  const router = useRouter();
  const t = useIntlayer('workspaceOverview');
  const tc = useIntlayer('workspaceCurrencySelector');
  const { currentWorkspace, refreshWorkspaces, clearWorkspace, updateWorkspaceBackground } =
    useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([]);

  useEffect(() => {
    if (!currentWorkspace) {
      return;
    }
    setName(currentWorkspace.name ?? '');
    setDescription(currentWorkspace.description ?? '');
    setCurrency(currentWorkspace.currency ?? '');
  }, [currentWorkspace]);

  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);

  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );

  const selectedCurrencyItem = currency ? currencyByCode.get(currency) : null;
  const currencyQuery = currencySearch.trim().toLowerCase();

  const selectedMatchesSearch = useMemo(() => {
    if (!selectedCurrencyItem) {
      return false;
    }
    if (!currencyQuery) {
      return true;
    }
    return selectedCurrencyItem.searchText.includes(currencyQuery);
  }, [selectedCurrencyItem, currencyQuery]);

  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== currency),
    [recentCurrencies, currencyByCode, currency],
  );

  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;

    return source.filter(item => item.code !== currency);
  }, [currencyItems, currencyQuery, currency]);

  const notSelectedLabel = tc.notSelected.value;

  const isDirty =
    Boolean(currentWorkspace) &&
    (name !== (currentWorkspace?.name ?? '') ||
      description !== (currentWorkspace?.description ?? '') ||
      currency !== (currentWorkspace?.currency ?? ''));

  const isDeleteConfirmationMatched =
    deleteConfirmationName.trim() === (currentWorkspace?.name ?? '');

  const handleSave = async () => {
    if (!(currentWorkspace && name.trim())) {
      return;
    }

    setSaving(true);

    await (async () => {
      await apiClient.patch(`/workspaces/${currentWorkspace.id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        currency: currency || undefined,
      });
      await refreshWorkspaces();
      toast.success(t.toasts.updated.value);
    })()
      .catch(async err => {
        console.error('Failed to update workspace:', err);
        toast.error(t.toasts.updateFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleDelete = async () => {
    if (!currentWorkspace) {
      return;
    }
    if (!isDeleteConfirmationMatched) {
      return;
    }

    setDeleting(true);

    await (async () => {
      await apiClient.delete(`/workspaces/${currentWorkspace.id}`);
      clearWorkspace();
      await refreshWorkspaces();
      toast.success(t.toasts.deleted.value);
      setDeleteModalOpen(false);
      setDeleteConfirmationName('');
      router.replace('/workspaces/list');
    })()
      .catch(async err => {
        console.error('Failed to delete workspace:', err);
        toast.error(t.toasts.deleteFailed.value);
      })
      .finally(async () => {
        setDeleting(false);
      });
  };

  const openDeleteModal = () => {
    setDeleteConfirmationName('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) {
      return;
    }
    setDeleteModalOpen(false);
    setDeleteConfirmationName('');
  };

  const pushRecentCurrency = (currencyCode: string) => {
    setRecentCurrencies(prev => [currencyCode, ...prev.filter(item => item !== currencyCode)]);
  };

  const handleSelectCurrency = (currencyCode: string) => {
    const previousCurrency = currency;
    setCurrency(currencyCode);
    if (previousCurrency && previousCurrency !== currencyCode) {
      pushRecentCurrency(previousCurrency);
    }
    setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  const handleBackgroundChange = async (background: string) => {
    if (!currentWorkspace) {
      return;
    }
    setSavingBackground(true);

    await (async () => {
      await updateWorkspaceBackground({
        workspaceId: currentWorkspace.id,
        backgroundImage: background,
      });
      toast.success(t.toasts.backgroundUpdated.value);
      setShowBackgroundPicker(false);
    })()
      .catch(async () => {
        toast.error(t.toasts.backgroundFailed.value);
      })
      .finally(async () => {
        setSavingBackground(false);
      });
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <Box
      sx={{
        height: 'calc(100vh - var(--global-nav-height, 0px))',
        overflowY: 'auto',
        bgcolor: 'var(--background)',
      }}
    >
      <Box
        sx={{ maxWidth: 1120, px: { xs: 2.5, sm: 4 }, py: 3 }}
        data-tour-id="workspace-side-panel"
      >
        <SettingsSection
          title={t.background.title}
          description={t.background.description}
          tourId="workspace-background"
        >
          {/* The preview is the control: click it (or its hover label) to change the image. */}
          <Box
            component="button"
            type="button"
            data-testid="workspace-background-trigger"
            aria-label={t.background.changeAria.value}
            onClick={() => setShowBackgroundPicker(true)}
            disabled={savingBackground}
            sx={{
              position: 'relative',
              display: 'block',
              aspectRatio: '2.8/1',
              width: '100%',
              maxWidth: 360,
              p: 0,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              bgcolor: 'transparent',
              cursor: 'pointer',
              opacity: savingBackground ? 0.6 : 1,
              '&:hover .workspace-background-change, &:focus-visible .workspace-background-change':
                {
                  opacity: 1,
                },
            }}
          >
            {resolveBackgroundSrc(currentWorkspace.backgroundImage) ? (
              <img
                src={resolveBackgroundSrc(currentWorkspace.backgroundImage) || ''}
                alt={t.background.currentAlt.value}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  px: 2,
                  textAlign: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                  {t.background.none}
                </Typography>
              </Box>
            )}
            <Box
              component="span"
              className="workspace-background-change"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                bgcolor: 'rgba(0, 0, 0, 0.45)',
                opacity: 0,
                transition: 'opacity 150ms ease',
                '@media (hover: none)': { opacity: 1, bgcolor: 'rgba(0, 0, 0, 0.3)' },
              }}
            >
              <ImageIcon size={15} />
              {t.background.change}
            </Box>
          </Box>
        </SettingsSection>

        <SettingsSection title={t.details.title} description={t.details.description}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <label htmlFor="workspace-name" style={FIELD_LABEL_STYLE}>
                {t.details.name}
              </label>
              <input
                id="workspace-name"
                data-tour-id="workspace-name"
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                style={FIELD_STYLE}
              />
            </Box>

            <Box>
              <label htmlFor="workspace-description" style={FIELD_LABEL_STYLE}>
                {t.details.descriptionLabel}
              </label>
              <textarea
                id="workspace-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                rows={2}
                style={{ ...FIELD_STYLE, minHeight: 80, resize: 'vertical' }}
              />
            </Box>

            <Box>
              <label htmlFor="workspace-currency-trigger" style={FIELD_LABEL_STYLE}>
                {t.details.currency}
              </label>
              <button
                id="workspace-currency-trigger"
                data-testid="workspace-currency-trigger"
                data-tour-id="workspace-currency"
                type="button"
                onClick={() => setCurrencyDrawerOpen(true)}
                style={{
                  ...FIELD_STYLE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {selectedCurrencyItem?.label || notSelectedLabel}
                </span>
                <ChevronDown
                  size={16}
                  style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
                />
              </button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  background: 'var(--primary-fill)',
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                  cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                  borderRadius: tokens.radius.md,
                  opacity: !isDirty || saving ? 0.6 : 1,
                }}
              >
                <Save size={16} />
                {saving ? t.details.saving : t.details.save}
              </button>

              {isDirty && (
                <Typography variant="body2" fontWeight={500} sx={{ color: 'warning.main' }}>
                  {t.details.unsaved}
                </Typography>
              )}
            </Box>
          </Box>
        </SettingsSection>

        <BusinessProfileSection />

        <InvoiceSettingsSection />

        <TaxJurisdictionSection
          labels={{
            title: t.tax.title.value,
            description: t.tax.description.value,
            none: t.tax.none.value,
            placeholder: t.tax.placeholder.value,
            ratesTitle: t.tax.ratesTitle.value,
            apply: t.tax.apply.value,
            applying: t.tax.applying.value,
            switchWarning: t.tax.switchWarning.value,
            noRates: t.tax.noRates.value,
            loadError: t.tax.loadError.value,
            saveError: t.tax.saveError.value,
            saved: t.tax.saved.value,
            disclaimer: t.tax.disclaimer.value,
            reportError: t.tax.reportError.value,
          }}
        />

        <TaxRulesSection />

        {currentWorkspace.memberRole === 'owner' && (
          <SettingsSection title={t.danger.title} tone="danger" description={t.danger.description}>
            <button
              type="button"
              onClick={openDeleteModal}
              disabled={deleting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--color-error-soft-border)',
                background: 'transparent',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--destructive)',
                cursor: deleting ? 'not-allowed' : 'pointer',
                borderRadius: tokens.radius.md,
                opacity: deleting ? 0.6 : 1,
              }}
            >
              <Trash2 size={16} />
              {deleting ? t.danger.deleting : t.danger.deleteWorkspace}
            </button>
          </SettingsSection>
        )}
      </Box>

      {/* Background picker drawer */}
      <DrawerShell
        isOpen={showBackgroundPicker}
        onClose={() => setShowBackgroundPicker(false)}
        position="right"
        width="lg"
        showCloseButton={false}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <button
              type="button"
              onClick={() => setShowBackgroundPicker(false)}
              style={{
                borderRadius: tokens.radius.full,
                padding: 8,
                color: 'var(--muted-foreground)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={t.background.closeDrawer.value}
            >
              <ChevronLeft size={20} />
            </button>
            <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--foreground)' }}>
              {t.background.drawerTitle}
            </Typography>
          </Box>
        }
      >
        <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>
            <Typography variant="body2" sx={{ color: 'var(--muted-foreground)', mb: 1.5 }}>
              {t.background.drawerHint}
            </Typography>
            {savingBackground && (
              <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                {t.details.saving}
              </Typography>
            )}
            <BackgroundSelector
              selectedBackground={currentWorkspace.backgroundImage}
              onSelect={handleBackgroundChange}
              backgrounds={AVAILABLE_BACKGROUNDS}
            />
          </Box>
        </Box>
      </DrawerShell>

      {/* Currency drawer */}
      <CurrencyDrawer
        isOpen={currencyDrawerOpen}
        onClose={() => {
          setCurrencyDrawerOpen(false);
          setCurrencySearch('');
        }}
        currencySearch={currencySearch}
        setCurrencySearch={setCurrencySearch}
        selectedCurrencyItem={selectedCurrencyItem}
        selectedMatchesSearch={selectedMatchesSearch}
        currencyQuery={currencyQuery}
        recentCurrencyItems={recentCurrencyItems}
        allCurrencyItems={allCurrencyItems}
        handleSelectCurrency={handleSelectCurrency}
        noneOption={{
          label: notSelectedLabel,
          selected: !currency,
          onSelect: () => handleSelectCurrency(''),
        }}
      />

      {/* Delete modal */}
      <ModalShell
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        size="sm"
        closeOnBackdropClick={!deleting}
        closeOnEscape={!deleting}
        title={t.deleteModal.title.value}
        paperSx={{
          borderRadius: tokens.radius.xl,
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          boxShadow: 24,
        }}
        footer={
          <ModalFooter
            onCancel={closeDeleteModal}
            onConfirm={handleDelete}
            cancelText={t.deleteModal.cancel.value}
            confirmText={deleting ? t.danger.deleting.value : t.deleteModal.confirm.value}
            confirmVariant="destructive"
            isConfirmLoading={deleting}
            isConfirmDisabled={!isDeleteConfirmationMatched || deleting}
          />
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.75, color: 'var(--muted-foreground)' }}>
            {t.deleteModal.body}
          </Typography>
          <Box>
            <label
              htmlFor="delete-workspace-name"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--foreground)',
                marginBottom: 6,
              }}
            >
              {t.details.name}
            </label>
            <input
              id="delete-workspace-name"
              type="text"
              value={deleteConfirmationName}
              onChange={event => setDeleteConfirmationName(event.target.value)}
              placeholder={currentWorkspace.name}
              autoComplete="off"
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                padding: '10px 12px',
                fontSize: 14,
                color: 'var(--foreground)',
                borderRadius: tokens.radius.md,
                boxSizing: 'border-box',
              }}
            />
          </Box>
        </Box>
      </ModalShell>
    </Box>
  );
}
