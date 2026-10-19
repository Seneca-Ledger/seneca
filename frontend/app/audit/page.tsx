'use client';

import { useTheme } from 'next-themes';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { AuditEventDrawer } from './components/AuditEventDrawer';
import { AuditFilterBar } from './components/AuditFilterBar';
import { AuditRollbackModal } from './components/AuditRollbackModal';
import { AuditTimeline, AuditTimelineSkeleton } from './components/AuditTimeline';
import { useAuditLoader } from './hooks/useAuditLoader';
import { useAuditRollback } from './hooks/useAuditRollback';

export default function AuditPage() {
  const t = useIntlayer('auditUi');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const loader = useAuditLoader();
  const [selectedEvent, setSelectedEvent] = useState<import('@/lib/api/audit').AuditEvent | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rollback = useAuditRollback({
    onAfterRollback: loader.reload,
    onCloseDrawer: () => setDrawerOpen(false),
  });

  const onSelectEvent = (event: import('@/lib/api/audit').AuditEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const handleFiltersChange = (update: Partial<import('@/lib/api/audit').AuditEventFilter>) => {
    loader.setFilters(prev => ({ ...prev, ...update }));
    loader.setPage(1);
  };

  return (
    <div className="audit-page">
      {/* Header */}
      <div className="audit-page__head">
        <button
          type="button"
          onClick={() => toast(t.exportComingSoon.value)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 36,
            padding: '0 14px',
            fontSize: 13,
            fontWeight: 500,
            color: c.ink700,
            background: c.surface,
            border: `1px solid ${c.ink200}`,
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          {t.exportLog}
        </button>
      </div>

      {/* Filter bar */}
      <AuditFilterBar filters={loader.filters} onFiltersChange={handleFiltersChange} />

      {/* Error */}
      {loader.error && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: c.danger,
            background: c.dangerSoft,
            border: `1px solid ${c.danger}`,
            borderRadius: tokens.radius.md,
          }}
        >
          {loader.error}
        </div>
      )}

      {/* Timeline */}
      <div
        className="audit-timeline-card"
        style={{ opacity: loader.isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}
      >
        {loader.isPending ? (
          <AuditTimelineSkeleton />
        ) : (
          <AuditTimeline
            events={loader.events}
            onSelect={onSelectEvent}
            onRollback={rollback.handleRollback}
            page={loader.page}
            limit={loader.limit}
            total={loader.total}
            onPageChange={loader.setPage}
          />
        )}
      </div>

      {/* Drawer */}
      <AuditEventDrawer
        event={selectedEvent}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRollback={rollback.handleRollback}
      />

      {/* Rollback confirm modal */}
      <AuditRollbackModal rollback={rollback} />
    </div>
  );
}
