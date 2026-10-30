'use client';

import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { tokens } from '@/lib/theme-tokens';
import { ActiveRouteFilter } from './ActiveRouteFilter';
import { useAmountViewText } from './ChoiceFilterScreen';
import { getScreenTitle, ScreenContent } from './FilterScreenContent';
import { FilterSection } from './FilterSection';
import { buildFilterRows, RootFilterRows } from './filter-root-rows';
import type { FiltersDrawerProps } from './filters-drawer.types';

export function FiltersDrawer({
  open,
  onClose,
  filters,
  screen,
  visibleScreens,
  onBack,
  onSelect,
  onUpdateFilters,
  onResetAll,
  onViewResults,
  typeOptions,
  statusOptions,
  datePresets,
  dateModes,
  fromOptions,
  toOptions,
  groupByOptions,
  hasOptions,
  currencyOptions,
  labels,
  activeCount,
  routeFilterLabel,
  onResetRouteFilter,
}: FiltersDrawerProps) {
  const isRoot = screen === 'root';
  const allowedScreens = new Set(visibleScreens || []);
  const isScreenVisible = (screenId: string) =>
    visibleScreens === undefined || allowedScreens.has(screenId);
  const amountView = useAmountViewText();
  const screenTitle = isRoot
    ? labels.title
    : screen === 'amountView'
      ? amountView.title
      : getScreenTitle(screen, labels);

  const toggleValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: tokens.radius.md,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    padding: '8px 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    boxSizing: 'border-box',
  };

  const filterRows = buildFilterRows(filters, labels, amountView);

  const viewResultsButton = (
    <MuiButton variant="contained" sx={{ width: '100%' }} size="large" onClick={onViewResults}>
      {labels.viewResults}
      {activeCount > 0 && (
        <Box
          component="span"
          sx={{
            ml: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: tokens.radius.full,
            bgcolor: 'rgba(255,255,255,0.2)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {activeCount}
        </Box>
      )}
    </MuiButton>
  );

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="sm"
      showCloseButton={false}
      title={
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              type="button"
              onClick={isRoot ? onClose : onBack}
              aria-label={screenTitle}
              size="small"
            >
              <ChevronLeft size={20} />
            </IconButton>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {screenTitle}
            </Typography>
          </Box>
          {isRoot && (
            <button
              type="button"
              onClick={onResetAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--primary)',
              }}
            >
              {labels.resetFilters}
            </button>
          )}
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {isRoot ? (
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              pb: 14,
            }}
          >
            {routeFilterLabel && onResetRouteFilter ? (
              <ActiveRouteFilter
                label={routeFilterLabel}
                resetLabel={labels.reset ?? labels.resetFilters}
                onReset={onResetRouteFilter}
              />
            ) : null}
            <FilterSection title={labels.general}>
              <RootFilterRows
                rows={filterRows.general}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
            <FilterSection title={labels.expenses}>
              <RootFilterRows
                rows={filterRows.expenses}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
            <FilterSection title={labels.reports}>
              <RootFilterRows
                rows={filterRows.reports}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              pb: 10,
            }}
          >
            <Box sx={{ bgcolor: 'transparent', p: 0 }}>
              {routeFilterLabel && onResetRouteFilter ? (
                <Box sx={{ mb: 2.5 }}>
                  <ActiveRouteFilter
                    label={routeFilterLabel}
                    resetLabel={labels.reset ?? labels.resetFilters}
                    onReset={onResetRouteFilter}
                  />
                </Box>
              ) : null}
              <ScreenContent
                screen={screen}
                filters={filters}
                labels={labels}
                typeOptions={typeOptions}
                statusOptions={statusOptions}
                datePresets={datePresets}
                dateModes={dateModes}
                fromOptions={fromOptions}
                toOptions={toOptions}
                groupByOptions={groupByOptions}
                amountViewOptions={amountView.options}
                hasOptions={hasOptions}
                currencyOptions={currencyOptions}
                onUpdateFilters={onUpdateFilters}
                toggleValue={toggleValue}
                inputStyle={inputStyle}
              />
            </Box>
          </Box>
        )}

        {isRoot ? (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              pt: 2,
              pb: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <MuiButton variant="outlined" sx={{ width: '100%' }} size="large" disabled>
              {labels.saveSearch}
            </MuiButton>
            {viewResultsButton}
          </Box>
        ) : (
          <Box sx={{ position: 'sticky', bottom: 0, pt: 2, pb: 1, bgcolor: 'background.paper' }}>
            {viewResultsButton}
          </Box>
        )}
      </Box>
    </DrawerShell>
  );
}
