'use client';

import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from '@/app/components/icons';
import { closeOnBackdropClick } from '@/app/components/ui/backdrop-click';
import { useIntlayer } from '@/app/i18n';
import { DEFAULT_RECENT_CURRENCIES } from '@/app/lib/currency';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
} from '@/app/lib/statement-expense-drawer';
import { tokens } from '@/lib/theme-tokens';

interface CurrencySelectorProps {
  selectedCurrency: string | null;
  onSelect: (currency: string) => void;
  mode?: 'modal' | 'inline';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showLabel?: boolean;
  showTrigger?: boolean;
  title?: string;
  minimal?: boolean;
  showPanelHeader?: boolean;
  /** 'large' for full-screen flows: form-sized search and rows, and the list takes the height. */
  size?: 'default' | 'large';
}

function useCurrencyOpenState({
  open,
  onOpenChange,
}: {
  open: boolean | undefined;
  onOpenChange?: (open: boolean) => void;
}): {
  isOpen: boolean;
  setOpenState: (v: boolean) => void;
} {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? Boolean(open) : internalOpen;
  const setOpenState = (nextOpen: boolean): void => {
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  return { isOpen, setOpenState };
}

function useCurrencySearch({
  selectedCurrency,
  setOpenState,
}: {
  selectedCurrency: string | null;
  setOpenState: (v: boolean) => void;
}): {
  search: string;
  selectedCurrencyItem: CurrencySearchItem | undefined;
  currencyQuery: string;
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  setSearch: (v: string) => void;
  handleSelectCurrency: (code: string) => void;
} {
  const [search, setSearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);
  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );
  const selectedCurrencyItem = selectedCurrency ? currencyByCode.get(selectedCurrency) : undefined;
  const currencyQuery = search.trim().toLowerCase();
  const selectedMatchesSearch = useMemo(() => {
    if (!selectedCurrencyItem) return false;
    return !currencyQuery || selectedCurrencyItem.searchText.includes(currencyQuery);
  }, [selectedCurrencyItem, currencyQuery]);
  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter(
          (item): item is CurrencySearchItem => Boolean(item) && item?.code !== selectedCurrency,
        ),
    [recentCurrencies, currencyByCode, selectedCurrency],
  );
  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== selectedCurrency);
  }, [currencyItems, currencyQuery, selectedCurrency]);
  const handleSelectCurrency = (code: string): void => {
    setRecentCurrencies(prev => [code, ...prev.filter(c => c !== code)]);
    setSearch('');
    setOpenState(false);
  };
  return {
    search,
    selectedCurrencyItem,
    currencyQuery,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
    setSearch,
    handleSelectCurrency,
  };
}

type CurrencyItemBtnProps = {
  item: CurrencySearchItem;
  minimal: boolean;
  large?: boolean;
  onSelect: (code: string) => void;
  isSelected?: boolean;
};
function CurrencyItemButton({
  item,
  minimal,
  large = false,
  onSelect,
  isSelected,
}: CurrencyItemBtnProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.code)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isSelected ? 'rgba(var(--primary-rgb,22,129,24),0.1)' : 'none',
        border: 'none',
        padding: large ? '12px 14px' : minimal ? '8px 12px' : '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: tokens.radius.md,
      }}
    >
      <span
        style={{
          fontSize: large ? 16 : 14,
          fontWeight: isSelected ? 600 : 500,
          color: isSelected ? 'var(--primary)' : 'var(--foreground)',
        }}
      >
        {item.label}
      </span>
      {isSelected && <Check size={16} style={{ color: 'var(--primary)' }} />}
    </button>
  );
}

type RecentsListProps = {
  items: CurrencySearchItem[];
  minimal: boolean;
  large?: boolean;
  onSelect: (code: string) => void;
};
function RecentsList({
  items,
  minimal,
  large,
  onSelect,
}: RecentsListProps): React.JSX.Element | null {
  const t = useIntlayer('workspaceCurrencySelector');
  if (items.length === 0) return null;
  return (
    <Box>
      {!minimal && (
        <Typography
          variant="caption"
          sx={{
            px: 0.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted-foreground)',
          }}
        >
          {t.recents}
        </Typography>
      )}
      <Box sx={{ mt: minimal ? 0.75 : 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {items.map(item => (
          <CurrencyItemButton
            key={`recent-${item.code}`}
            item={item}
            minimal={minimal}
            large={large}
            onSelect={onSelect}
          />
        ))}
      </Box>
    </Box>
  );
}

type AllCurrenciesListProps = {
  items: CurrencySearchItem[];
  minimal: boolean;
  large?: boolean;
  onSelect: (code: string) => void;
};
function AllCurrenciesList({
  items,
  minimal,
  large,
  onSelect,
}: AllCurrenciesListProps): React.JSX.Element {
  const t = useIntlayer('workspaceCurrencySelector');
  return (
    <Box>
      {!minimal && (
        <Typography
          variant="caption"
          sx={{
            px: 0.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted-foreground)',
          }}
        >
          {t.all}
        </Typography>
      )}
      <Box sx={{ mt: minimal ? 0.75 : 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {items.length > 0 ? (
          items.map(item => (
            <CurrencyItemButton
              key={item.code}
              item={item}
              minimal={minimal}
              large={large}
              onSelect={onSelect}
            />
          ))
        ) : (
          <Box sx={{ bgcolor: 'var(--muted)', borderRadius: tokens.radius.md, px: 1.5, py: 1.25 }}>
            <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
              {t.noCurrencies}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Search and list dimensions per variant; kept out of the panel so its markup stays one shape. */
function panelMetrics(minimal: boolean, large: boolean) {
  if (large) {
    return {
      iconSize: 18,
      iconLeft: 14,
      inputBorder: '1px solid var(--border)',
      inputPadding: '13px 14px 13px 42px',
      inputFontSize: 16,
      // Fills what the page leaves around it instead of a third of the screen.
      listMaxHeight: 'max(320px, calc(100vh - 380px))',
    };
  }
  return {
    iconSize: 16,
    iconLeft: 12,
    inputBorder: minimal ? '1px solid transparent' : '1px solid var(--border)',
    inputPadding: '10px 12px 10px 40px',
    inputFontSize: 14,
    listMaxHeight: minimal ? '34vh' : '72vh',
  };
}

type PanelProps = {
  minimal: boolean;
  large: boolean;
  showPanelHeader: boolean;
  title: string;
  search: string;
  selectedCurrencyItem: CurrencySearchItem | undefined;
  selectedMatchesSearch: boolean;
  currencyQuery: string;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  onSearchChange: (v: string) => void;
  onClose: () => void;
  onSelect: (code: string) => void;
};

// eslint-disable-next-line max-lines-per-function, complexity
function CurrencyPanel({
  minimal,
  large,
  showPanelHeader,
  title,
  search,
  selectedCurrencyItem,
  selectedMatchesSearch,
  currencyQuery,
  recentCurrencyItems,
  allCurrencyItems,
  onSearchChange,
  onClose,
  onSelect,
}: PanelProps): React.JSX.Element {
  const t = useIntlayer('workspaceCurrencySelector');
  const metrics = panelMetrics(minimal, large);
  return (
    <Box
      sx={
        minimal
          ? { width: '100%' }
          : {
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              bgcolor: 'var(--card)',
              p: 2.5,
            }
      }
    >
      {!minimal && showPanelHeader && (
        <Box
          sx={{
            mb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--foreground)' }}>
            {title}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: tokens.radius.full,
              padding: 8,
              color: 'var(--muted-foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label={t.closePicker.value}
          >
            <X size={16} />
          </button>
        </Box>
      )}
      <Box sx={{ position: 'relative', mb: minimal ? 1 : 1.5, mt: minimal ? 1 : 0 }}>
        <Search
          size={metrics.iconSize}
          style={{
            position: 'absolute',
            left: metrics.iconLeft,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted-foreground)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t.search.value}
          style={{
            width: '100%',
            border: metrics.inputBorder,
            background: minimal ? 'var(--card-bg)' : 'var(--card)',
            padding: metrics.inputPadding,
            fontSize: metrics.inputFontSize,
            color: 'var(--foreground)',
            borderRadius: tokens.radius.md,
            boxSizing: 'border-box',
          }}
        />
      </Box>
      <Box
        sx={{
          overflowY: 'auto',
          pr: 0.5,
          maxHeight: metrics.listMaxHeight,
          display: 'flex',
          flexDirection: 'column',
          gap: minimal ? 0.75 : 1.5,
        }}
      >
        {selectedCurrencyItem && selectedMatchesSearch && (
          <CurrencyItemButton
            item={selectedCurrencyItem}
            minimal={minimal}
            large={large}
            onSelect={onSelect}
            isSelected
          />
        )}
        {currencyQuery.length === 0 && (
          <RecentsList
            items={recentCurrencyItems}
            minimal={minimal}
            large={large}
            onSelect={onSelect}
          />
        )}
        <AllCurrenciesList
          items={allCurrencyItems}
          minimal={minimal}
          large={large}
          onSelect={onSelect}
        />
      </Box>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function, complexity
export function CurrencySelector({
  selectedCurrency,
  onSelect,
  mode = 'modal',
  open,
  onOpenChange,
  showLabel = true,
  showTrigger = true,
  title: titleProp,
  minimal = false,
  showPanelHeader = true,
  size = 'default',
}: CurrencySelectorProps): React.JSX.Element {
  const t = useIntlayer('workspaceCurrencySelector');
  const title = titleProp ?? t.selectCurrency.value;
  const { isOpen, setOpenState } = useCurrencyOpenState({ open, onOpenChange });
  const {
    search,
    selectedCurrencyItem,
    currencyQuery,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
    setSearch,
    handleSelectCurrency,
  } = useCurrencySearch({ selectedCurrency, setOpenState });

  const handleSelect = (code: string): void => {
    onSelect(code);
    handleSelectCurrency(code);
  };
  const handleClose = (): void => {
    setOpenState(false);
    setSearch('');
  };

  const panel = (
    <CurrencyPanel
      minimal={minimal}
      large={size === 'large'}
      showPanelHeader={showPanelHeader}
      title={title}
      search={search}
      selectedCurrencyItem={selectedCurrencyItem}
      selectedMatchesSearch={selectedMatchesSearch}
      currencyQuery={currencyQuery}
      recentCurrencyItems={recentCurrencyItems}
      allCurrencyItems={allCurrencyItems}
      onSearchChange={setSearch}
      onClose={handleClose}
      onSelect={handleSelect}
    />
  );

  return (
    <Box>
      {showLabel && (
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1, color: 'var(--foreground)' }}>
          {t.label}
        </Typography>
      )}
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpenState(true)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            padding: '10px 12px',
            fontSize: 14,
            color: 'var(--foreground)',
            cursor: 'pointer',
            textAlign: 'left',
            borderRadius: tokens.radius.md,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCurrencyItem?.label || t.selectCurrency}
          </span>
          <ChevronDown size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        </button>
      )}
      {isOpen && mode === 'inline' && <Box sx={{ mt: minimal ? 0.5 : 1.5 }}>{panel}</Box>}
      {/* Modal traps focus inside the picker, closes on Escape and restores focus. */}
      <Modal open={isOpen && mode !== 'inline'} onClose={handleClose} hideBackdrop>
        <Box
          tabIndex={-1}
          onClick={closeOnBackdropClick(handleClose)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            outline: 'none',
          }}
        >
          <Box
            role="dialog"
            aria-modal="true"
            aria-label={title}
            sx={{ width: '100%', maxWidth: 896 }}
          >
            {panel}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}
