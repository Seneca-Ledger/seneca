'use client';

import { Box, Paper, TextField, Typography } from '@mui/material';
import React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import type { AuditEvent, AuditEventFilter } from '@/lib/api/audit';
import { AuditEventDrawer } from '../../audit/components/AuditEventDrawer';
import { AuditEventTable } from '../../audit/components/AuditEventTable';

const ENTITY_TYPES = [
  'transaction',
  'statement',
  'receipt',
  'category',
  'rule',
  'workspace',
  'integration',
  'table_row',
  'table_cell',
  'branch',
  'wallet',
  'custom_table',
  'custom_table_column',
] as const;

const ACTIONS = [
  'create',
  'update',
  'delete',
  'import',
  'link',
  'unlink',
  'match',
  'unmatch',
  'apply_rule',
  'rollback',
  'export',
] as const;

const SEVERITIES = ['info', 'warn', 'critical'] as const;

export interface AdminAuditTabProps {
  auditLogs: AuditEvent[];
  auditTotal: number;
  auditPage: number;
  auditLimit: number;
  auditFilters: AuditEventFilter;
  auditLoading: boolean;
  auditError: string | null;
  selectedAuditEvent: AuditEvent | null;
  auditDrawerOpen: boolean;
  labels: {
    title: React.ReactNode;
    helper: React.ReactNode;
    filtersTitle: React.ReactNode;
    filterEntityType: React.ReactNode;
    filterAll: React.ReactNode;
    filterUser: React.ReactNode;
    filterAction: React.ReactNode;
    filterEntityId: React.ReactNode;
    filterSeverity: React.ReactNode;
    filterDateFrom: React.ReactNode;
    filterDateTo: React.ReactNode;
    loading: React.ReactNode;
    empty: React.ReactNode;
  };
  onFilterChange: ({ key, value }: { key: keyof AuditEventFilter; value: string }) => void;
  onPageChange: (page: number) => void;
  onSelectEvent: (event: AuditEvent) => void;
  onCloseDrawer: () => void;
}

type FilterProps = {
  filters: AuditEventFilter;
  labels: AdminAuditTabProps['labels'];
  onFilterChange: AdminAuditTabProps['onFilterChange'];
};

function AuditSelectFilters({ filters, labels, onFilterChange }: FilterProps): React.JSX.Element {
  return (
    <>
      <TextField
        select
        label={labels.filterEntityType}
        size="small"
        value={filters.entityType || ''}
        onChange={e => onFilterChange({ key: 'entityType', value: e.target.value })}
        slotProps={{
          select: { native: true },
        }}
      >
        <option value="">{labels.filterAll}</option>
        {ENTITY_TYPES.map(type => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </TextField>
      <TextField
        select
        label={labels.filterAction}
        size="small"
        value={filters.action || ''}
        onChange={e => onFilterChange({ key: 'action', value: e.target.value })}
        slotProps={{
          select: { native: true },
        }}
      >
        <option value="">{labels.filterAll}</option>
        {ACTIONS.map(action => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </TextField>
      <TextField
        select
        label={labels.filterSeverity}
        size="small"
        value={filters.severity || ''}
        onChange={e => onFilterChange({ key: 'severity', value: e.target.value })}
        slotProps={{
          select: { native: true },
        }}
      >
        <option value="">{labels.filterAll}</option>
        {SEVERITIES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </TextField>
    </>
  );
}

function AuditFilters({ filters, labels, onFilterChange }: FilterProps): React.JSX.Element {
  return (
    <Paper
      variant="outlined"
      className="seneca-audit-panel__filters"
      data-tour-id="admin-audit-filters"
    >
      <Typography variant="subtitle2" gutterBottom>
        {labels.filtersTitle}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        <AuditSelectFilters filters={filters} labels={labels} onFilterChange={onFilterChange} />
        <TextField
          label={labels.filterUser}
          size="small"
          value={filters.actorLabel || ''}
          onChange={e => onFilterChange({ key: 'actorLabel', value: e.target.value })}
        />
        <TextField
          label={labels.filterEntityId}
          size="small"
          value={filters.entityId || ''}
          onChange={e => onFilterChange({ key: 'entityId', value: e.target.value })}
        />
        <CustomDatePicker
          label={labels.filterDateFrom}
          value={filters.dateFrom || ''}
          onChange={value => onFilterChange({ key: 'dateFrom', value })}
        />
        <CustomDatePicker
          label={labels.filterDateTo}
          value={filters.dateTo || ''}
          onChange={value => onFilterChange({ key: 'dateTo', value })}
        />
      </Box>
    </Paper>
  );
}

function AuditResults({
  auditLogs,
  auditLoading,
  auditError,
  auditPage,
  auditLimit,
  auditTotal,
  labels,
  onSelectEvent,
  onPageChange,
}: {
  auditLogs: AuditEvent[];
  auditLoading: boolean;
  auditError: string | null;
  auditPage: number;
  auditLimit: number;
  auditTotal: number;
  labels: AdminAuditTabProps['labels'];
  onSelectEvent: AdminAuditTabProps['onSelectEvent'];
  onPageChange: AdminAuditTabProps['onPageChange'];
}): React.JSX.Element {
  if (auditError) {
    return (
      <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
        {auditError}
      </Box>
    );
  }
  if (auditLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {labels.loading}
        </Typography>
      </Paper>
    );
  }
  if (auditLogs.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {labels.empty}
        </Typography>
      </Paper>
    );
  }
  return (
    <AuditEventTable
      events={auditLogs}
      onSelect={onSelectEvent}
      page={auditPage}
      limit={auditLimit}
      total={auditTotal}
      onPageChange={onPageChange}
    />
  );
}

export function AdminAuditTab({
  auditLogs,
  auditTotal,
  auditPage,
  auditLimit,
  auditFilters,
  auditLoading,
  auditError,
  selectedAuditEvent,
  auditDrawerOpen,
  labels,
  onFilterChange,
  onPageChange,
  onSelectEvent,
  onCloseDrawer,
}: AdminAuditTabProps): React.JSX.Element {
  return (
    <Box className="seneca-audit-panel">
      <Box className="seneca-audit-panel__header">
        <Typography variant="h6" component="h2">
          {labels.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {labels.helper}
        </Typography>
      </Box>
      <Box className="seneca-audit-panel__layout">
        <AuditFilters filters={auditFilters} labels={labels} onFilterChange={onFilterChange} />
        <Box className="seneca-audit-panel__results">
          <AuditResults
            auditLogs={auditLogs}
            auditLoading={auditLoading}
            auditError={auditError}
            auditPage={auditPage}
            auditLimit={auditLimit}
            auditTotal={auditTotal}
            labels={labels}
            onSelectEvent={onSelectEvent}
            onPageChange={onPageChange}
          />
        </Box>
      </Box>
      <AuditEventDrawer event={selectedAuditEvent} open={auditDrawerOpen} onClose={onCloseDrawer} />
    </Box>
  );
}
