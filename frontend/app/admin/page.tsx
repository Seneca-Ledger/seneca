'use client';

import { Container, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import type { AuditEvent, AuditEventFilter } from '@/lib/api/audit';
import { fetchAuditEvents, rollbackEvent } from '@/lib/api/audit';
import { tokens } from '@/lib/theme-tokens';
import { AuditEventModal } from '../audit/components/AuditEventModal';
import { AuditFilterBar } from '../audit/components/AuditFilterBar';
import { AuditTimeline, AuditTimelineSkeleton } from '../audit/components/AuditTimeline';
import { assertRollbackSucceeded } from '../audit/utils/rollback-result';

export default function AdminPage() {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('adminPage');

  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(50);
  const [auditFilters, setAuditFilters] = useState<AuditEventFilter>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const auditParams = useMemo(
    () => ({ ...auditFilters, page: auditPage, limit: auditLimit }),
    [auditFilters, auditPage, auditLimit],
  );

  const loadAuditLogs = async (): Promise<void> => {
    setAuditLoading(true);
    setAuditError(null);

    await (async () => {
      const response = await fetchAuditEvents(auditParams);
      setAuditLogs(response.data || []);
      setAuditTotal(response.total || 0);
    })()
      .catch(async (err: unknown) => {
        const error = err as { response?: { data?: { message?: string } } };
        setAuditError(error.response?.data?.message || t.errors.loadAudit.value);
      })
      .finally(async () => {
        setAuditLoading(false);
      });
  };

  useEffect(() => {
    void loadAuditLogs();
  }, [auditParams]);

  const handleDirectRollback = async (event: AuditEvent): Promise<void> => {
    setRollbackLoading(true);

    await (async () => {
      const result = await rollbackEvent(event.id);
      assertRollbackSucceeded(result);
      toast.success(t.toasts.rollbackSuccess.value);
      setModalOpen(false);
      setSelectedEvent(null);
      void loadAuditLogs();
    })()
      .catch(async () => {
        toast.error(t.toasts.rollbackFailed.value);
      })
      .finally(async () => {
        setRollbackLoading(false);
      });
  };

  const handleFiltersChange = (update: Partial<AuditEventFilter>) => {
    setAuditFilters(prev => ({ ...prev, ...update }));
    setAuditPage(1);
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t.title}
      </Typography>

      <div className="audit-page" style={{ maxWidth: '100%', padding: '24px 0 0' }}>
        <div className="audit-page__head">
          <div>
            <h2 className="audit-page__title" style={{ fontSize: 18 }}>
              {t.auditTab.title}
            </h2>
            <p className="audit-page__subtitle">{t.auditTab.helper}</p>
          </div>
        </div>

        <AuditFilterBar filters={auditFilters} onFiltersChange={handleFiltersChange} />

        {auditError && (
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
            {auditError}
          </div>
        )}

        <div className="audit-timeline-card">
          {auditLoading ? (
            <AuditTimelineSkeleton />
          ) : (
            <AuditTimeline
              events={auditLogs}
              onSelect={event => {
                setSelectedEvent(event);
                setModalOpen(true);
              }}
              page={auditPage}
              limit={auditLimit}
              total={auditTotal}
              onPageChange={setAuditPage}
            />
          )}
        </div>
      </div>

      <AuditEventModal
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRollback={handleDirectRollback}
        rollbackLoading={rollbackLoading}
      />
    </Container>
  );
}
