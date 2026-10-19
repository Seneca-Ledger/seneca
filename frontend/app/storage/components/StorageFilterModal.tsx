'use client';

import { Box, IconButton, Modal, TextField, Typography } from '@mui/material';
import React from 'react';
import { Bookmark, Save, X } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { Spinner } from '@/app/components/ui/spinner';
import { tokens } from '@/lib/theme-tokens';
import type {
  CategoryOption,
  FolderOption,
  StorageView,
  StorageViewPayload,
} from '../storageHelpers';
import { DEFAULT_FILTERS, NO_FOLDER } from '../storageHelpers';

const filterSelectSx = { backgroundColor: 'rgba(249,250,251,0.5)', color: 'var(--foreground)' };
const filterLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted-foreground)',
};

type Filters = typeof DEFAULT_FILTERS;

export interface StorageFilterModalProps {
  stagedFilters: Filters;
  statusOptions: string[];
  bankOptions: string[];
  categories: CategoryOption[];
  folders: FolderOption[];
  views: StorageView[];
  viewsLoading: boolean;
  viewName: string;
  viewSaving: boolean;
  activeViewId: string | null;
  viewPayload: StorageViewPayload;
  filtersTitle: string;
  filtersStatusLabel: React.ReactNode;
  filtersBankLabel: React.ReactNode;
  filtersCategoryLabel: React.ReactNode;
  filtersAccessTypeLabel: React.ReactNode;
  filtersFolderLabel: React.ReactNode;
  filtersAllOption: React.ReactNode;
  filtersOwnedOption: React.ReactNode;
  filtersSharedOption: React.ReactNode;
  folderNoneLabel: React.ReactNode;
  filtersReset: React.ReactNode;
  filtersApply: React.ReactNode;
  viewCreateTitle: string;
  viewNamePlaceholder: string;
  viewSaveTooltip: string;
  viewsTitleLabel: React.ReactNode;
  viewsEmpty: React.ReactNode;
  viewDeleteLabel: string;
  getStatusLabel: (status: string) => string;
  onClose: () => void;
  onFilterChange: (field: keyof Filters, value: string) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
  onSetViewName: (name: string) => void;
  onSaveView: (payload: StorageViewPayload) => void;
  onDeleteView: (id: string) => void;
  onApplyView: (view: StorageView) => void;
}

export function StorageFilterModal({
  stagedFilters,
  statusOptions,
  bankOptions,
  categories,
  folders,
  views,
  viewsLoading,
  viewName,
  viewSaving,
  activeViewId,
  viewPayload,
  filtersTitle,
  filtersStatusLabel,
  filtersBankLabel,
  filtersCategoryLabel,
  filtersAccessTypeLabel,
  filtersFolderLabel,
  filtersAllOption,
  filtersOwnedOption,
  filtersSharedOption,
  folderNoneLabel,
  filtersReset,
  filtersApply,
  viewCreateTitle,
  viewNamePlaceholder,
  viewSaveTooltip,
  viewsTitleLabel,
  viewsEmpty,
  viewDeleteLabel,
  getStatusLabel,
  onClose,
  onFilterChange,
  onResetFilters,
  onApplyFilters,
  onSetViewName,
  onSaveView,
  onDeleteView,
  onApplyView,
}: StorageFilterModalProps): React.JSX.Element {
  const titleId = React.useId();
  // Modal traps focus inside, closes on Escape and restores focus on unmount.
  return (
    <Modal open onClose={onClose} hideBackdrop>
      <Box tabIndex={-1} sx={{ outline: 'none' }}>
        <Box
          aria-hidden="true"
          onClick={onClose}
          sx={{ position: 'fixed', inset: 0, zIndex: 50, bgcolor: 'rgba(0,0,0,0.4)' }}
        />
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            pointerEvents: 'none',
          }}
        >
          <Box
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            sx={{
              width: '100%',
              maxWidth: 896,
              bgcolor: 'background.paper',
              boxShadow: 24,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              overflow: 'hidden',
              border: '1px solid var(--muted)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 3,
                py: 2,
                borderBottom: '1px solid var(--muted)',
                flexShrink: 0,
                bgcolor: 'background.paper',
              }}
            >
              <Typography
                id={titleId}
                style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}
              >
                {filtersTitle}
              </Typography>
              <IconButton
                size="small"
                onClick={onClose}
                sx={{
                  color: 'var(--muted-foreground)',
                  borderRadius: tokens.radius.full,
                  '&:hover': { bgcolor: 'var(--muted)', color: 'var(--foreground)' },
                }}
              >
                <X size={20} />
              </IconButton>
            </Box>
            <Box
              sx={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
              }}
            >
              <FilterLeftPanel
                stagedFilters={stagedFilters}
                statusOptions={statusOptions}
                bankOptions={bankOptions}
                categories={categories}
                folders={folders}
                filtersStatusLabel={filtersStatusLabel}
                filtersBankLabel={filtersBankLabel}
                filtersCategoryLabel={filtersCategoryLabel}
                filtersAccessTypeLabel={filtersAccessTypeLabel}
                filtersFolderLabel={filtersFolderLabel}
                filtersAllOption={filtersAllOption}
                filtersOwnedOption={filtersOwnedOption}
                filtersSharedOption={filtersSharedOption}
                folderNoneLabel={folderNoneLabel}
                filtersReset={filtersReset}
                filtersApply={filtersApply}
                getStatusLabel={getStatusLabel}
                onFilterChange={onFilterChange}
                onResetFilters={onResetFilters}
                onApplyFilters={onApplyFilters}
              />
              <SavedViewsPanel
                views={views}
                viewsLoading={viewsLoading}
                viewName={viewName}
                viewSaving={viewSaving}
                activeViewId={activeViewId}
                viewPayload={viewPayload}
                viewCreateTitle={viewCreateTitle}
                viewNamePlaceholder={viewNamePlaceholder}
                viewSaveTooltip={viewSaveTooltip}
                viewsTitleLabel={viewsTitleLabel}
                viewsEmpty={viewsEmpty}
                viewDeleteLabel={viewDeleteLabel}
                onSetViewName={onSetViewName}
                onSaveView={onSaveView}
                onDeleteView={onDeleteView}
                onApplyView={onApplyView}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

interface FilterLeftPanelProps {
  stagedFilters: Filters;
  statusOptions: string[];
  bankOptions: string[];
  categories: CategoryOption[];
  folders: FolderOption[];
  filtersStatusLabel: React.ReactNode;
  filtersBankLabel: React.ReactNode;
  filtersCategoryLabel: React.ReactNode;
  filtersAccessTypeLabel: React.ReactNode;
  filtersFolderLabel: React.ReactNode;
  filtersAllOption: React.ReactNode;
  filtersOwnedOption: React.ReactNode;
  filtersSharedOption: React.ReactNode;
  folderNoneLabel: React.ReactNode;
  filtersReset: React.ReactNode;
  filtersApply: React.ReactNode;
  getStatusLabel: (status: string) => string;
  onFilterChange: (field: keyof Filters, value: string) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
}

function FilterLeftPanel({
  stagedFilters,
  statusOptions,
  bankOptions,
  categories,
  folders,
  filtersStatusLabel,
  filtersBankLabel,
  filtersCategoryLabel,
  filtersAccessTypeLabel,
  filtersFolderLabel,
  filtersAllOption,
  filtersOwnedOption,
  filtersSharedOption,
  folderNoneLabel,
  filtersReset,
  filtersApply,
  getStatusLabel,
  onFilterChange,
  onResetFilters,
  onApplyFilters,
}: FilterLeftPanelProps): React.JSX.Element {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        p: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <label htmlFor="storage-filter-status" style={filterLabelStyle}>
            {filtersStatusLabel}
          </label>
          <Select
            fullWidth
            id="storage-filter-status"
            value={stagedFilters.status}
            onChange={value => onFilterChange('status', value)}
            options={[
              { value: '', label: filtersAllOption },
              ...statusOptions.map(s => ({ value: s, label: getStatusLabel(s) })),
            ]}
            sx={filterSelectSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <label htmlFor="storage-filter-bank" style={filterLabelStyle}>
            {filtersBankLabel}
          </label>
          <Select
            fullWidth
            id="storage-filter-bank"
            value={stagedFilters.bank}
            onChange={value => onFilterChange('bank', value)}
            options={[
              { value: '', label: filtersAllOption },
              ...bankOptions.map(b => ({ value: b, label: b })),
            ]}
            sx={filterSelectSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <label htmlFor="storage-filter-category" style={filterLabelStyle}>
            {filtersCategoryLabel}
          </label>
          <Select
            fullWidth
            id="storage-filter-category"
            value={stagedFilters.categoryId}
            onChange={value => onFilterChange('categoryId', value)}
            options={[
              { value: '', label: filtersAllOption },
              ...categories.map(c => ({ value: c.id, label: c.name })),
            ]}
            sx={filterSelectSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <label htmlFor="storage-filter-ownership" style={filterLabelStyle}>
            {filtersAccessTypeLabel}
          </label>
          <Select
            fullWidth
            id="storage-filter-ownership"
            value={stagedFilters.ownership}
            onChange={value => onFilterChange('ownership', value)}
            options={[
              { value: '', label: filtersAllOption },
              { value: 'owned', label: filtersOwnedOption },
              { value: 'shared', label: filtersSharedOption },
            ]}
            sx={filterSelectSx}
          />
        </Box>
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, gridColumn: { sm: 'span 2' } }}
        >
          <label htmlFor="storage-filter-folder" style={filterLabelStyle}>
            {filtersFolderLabel}
          </label>
          <Select
            fullWidth
            id="storage-filter-folder"
            value={stagedFilters.folderId}
            onChange={value => onFilterChange('folderId', value)}
            options={[
              { value: '', label: filtersAllOption },
              { value: NO_FOLDER, label: folderNoneLabel },
              ...folders.map(f => ({ value: f.id, label: f.name })),
            ]}
            sx={filterSelectSx}
          />
        </Box>
      </Box>
      <Box
        sx={{
          mt: 'auto',
          pt: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          component="button"
          onClick={onResetFilters}
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            bgcolor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            px: 1,
            py: 0.5,
            '&:hover': { color: 'var(--foreground)' },
          }}
        >
          {filtersReset}
        </Box>
        <Box
          component="button"
          onClick={onApplyFilters}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'var(--primary-fill)',
            color: '#fff',
            px: 4,
            py: 1.25,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          {filtersApply}
        </Box>
      </Box>
    </Box>
  );
}

interface SavedViewsPanelProps {
  views: StorageView[];
  viewsLoading: boolean;
  viewName: string;
  viewSaving: boolean;
  activeViewId: string | null;
  viewPayload: StorageViewPayload;
  viewCreateTitle: string;
  viewNamePlaceholder: string;
  viewSaveTooltip: string;
  viewsTitleLabel: React.ReactNode;
  viewsEmpty: React.ReactNode;
  viewDeleteLabel: string;
  onSetViewName: (name: string) => void;
  onSaveView: (payload: StorageViewPayload) => void;
  onDeleteView: (id: string) => void;
  onApplyView: (view: StorageView) => void;
}

function SavedViewsPanel({
  views,
  viewsLoading,
  viewName,
  viewSaving,
  activeViewId,
  viewPayload,
  viewCreateTitle,
  viewNamePlaceholder,
  viewSaveTooltip,
  viewsTitleLabel,
  viewsEmpty,
  viewDeleteLabel,
  onSetViewName,
  onSaveView,
  onDeleteView,
  onApplyView,
}: SavedViewsPanelProps): React.JSX.Element {
  return (
    <Box
      sx={{
        width: { xs: '100%', md: 320 },
        borderLeft: '1px solid var(--muted)',
        bgcolor: 'var(--muted)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Bookmark style={{ width: 16, height: 16, color: 'var(--primary)' }} />
          <Typography style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
            {viewCreateTitle}
          </Typography>
        </Box>
        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            value={viewName}
            onChange={e => onSetViewName(e.target.value)}
            placeholder={viewNamePlaceholder}
            sx={{ flex: 1 }}
          />
          <IconButton
            size="small"
            onClick={() => onSaveView(viewPayload)}
            disabled={viewSaving || !viewName.trim()}
            title={viewSaveTooltip}
            sx={{
              border: '1px solid var(--border-color)',
              borderRadius: tokens.radius.sm,
              color: 'primary.main',
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'var(--primary-fill)', color: '#fff' },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            <Save size={18} />
          </IconButton>
        </Box>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
        >
          <Typography
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--muted-foreground)',
            }}
          >
            {viewsTitleLabel}
          </Typography>
          <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {views.length}
          </Typography>
        </Box>
        <ViewsList
          views={views}
          viewsLoading={viewsLoading}
          activeViewId={activeViewId}
          viewsEmpty={viewsEmpty}
          viewDeleteLabel={viewDeleteLabel}
          onDeleteView={onDeleteView}
          onApplyView={onApplyView}
        />
      </Box>
    </Box>
  );
}

interface ViewsListProps {
  views: StorageView[];
  viewsLoading: boolean;
  activeViewId: string | null;
  viewsEmpty: React.ReactNode;
  viewDeleteLabel: string;
  onDeleteView: (id: string) => void;
  onApplyView: (view: StorageView) => void;
}

function ViewsList({
  views,
  viewsLoading,
  activeViewId,
  viewsEmpty,
  viewDeleteLabel,
  onDeleteView,
  onApplyView,
}: ViewsListProps): React.JSX.Element {
  if (viewsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <Spinner className="h-5 w-5 text-gray-400" />
      </Box>
    );
  }
  if (views.length === 0) {
    return (
      <Typography
        style={{
          fontSize: 14,
          color: 'var(--muted-foreground)',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '16px 0',
        }}
      >
        {viewsEmpty}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {views.map(view => (
        <ViewItem
          key={view.id}
          view={view}
          activeViewId={activeViewId}
          viewDeleteLabel={viewDeleteLabel}
          onDeleteView={onDeleteView}
          onApplyView={onApplyView}
        />
      ))}
    </Box>
  );
}

interface ViewItemProps {
  view: StorageView;
  activeViewId: string | null;
  viewDeleteLabel: string;
  onDeleteView: (id: string) => void;
  onApplyView: (view: StorageView) => void;
}

function ViewItem({
  view,
  activeViewId,
  viewDeleteLabel,
  onDeleteView,
  onApplyView,
}: ViewItemProps): React.JSX.Element {
  const isActive = activeViewId === view.id;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        border: '1px solid',
        borderColor: isActive ? 'rgba(var(--primary-rgb),0.3)' : 'var(--border-color)',
        bgcolor: isActive ? 'rgba(var(--primary-rgb),0.05)' : 'background.paper',
        px: 1.5,
        py: 1.25,
        '&:hover .view-delete-btn, &:focus-within .view-delete-btn': { opacity: 1 },
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => onApplyView(view)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minWidth: 0,
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--foreground)',
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isActive && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: tokens.radius.full,
              bgcolor: 'primary.main',
              flexShrink: 0,
            }}
          />
        )}
        <Typography
          style={{
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {view.name}
        </Typography>
      </Box>
      <IconButton
        size="small"
        className="view-delete-btn"
        onClick={() => onDeleteView(view.id)}
        title={viewDeleteLabel}
        sx={{
          color: 'var(--border-color)',
          opacity: 0,
          borderRadius: tokens.radius.sm,
          '&:hover': { color: 'var(--destructive)', bgcolor: 'transparent' },
        }}
      >
        <X size={14} />
      </IconButton>
    </Box>
  );
}
