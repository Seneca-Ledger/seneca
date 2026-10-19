'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from 'next-themes';
import React from 'react';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import type { AuditEvent } from '@/lib/api/audit';
import { tokens } from '@/lib/theme-tokens';
import { formatAuditEvent } from '../utils/formatAuditEvent';
import { DiffViewer } from './DiffViewer';

interface AuditEventDrawerProps {
  event: AuditEvent | null;
  open: boolean;
  onClose: () => void;
  onRollback?: (event: AuditEvent) => void;
}

type FormattedEvent = ReturnType<typeof formatAuditEvent>;

function EventMetaRows({
  event,
  formatted,
}: {
  event: AuditEvent;
  formatted: FormattedEvent;
}): React.JSX.Element {
  const t = useIntlayer('auditEventDrawer');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  const rows = [
    { label: t.timestamp.value, value: formatStoredDateTime(event.createdAt) },
    { label: t.actor.value, value: event.actorLabel },
    { label: t.action.value, value: formatted.actionLabel },
    { label: t.entity.value, value: formatted.objectLabel },
  ];
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        border: `1px solid ${c.border}`,
        bgcolor: c.ink50,
        p: 2,
        fontSize: 14,
      }}
    >
      {rows.map(row => (
        <Box
          key={row.label}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span style={{ color: c.ink700, fontSize: 14 }}>{row.label}</span>
          <span style={{ fontWeight: 600, color: c.ink900, fontSize: 14 }}>{row.value}</span>
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: c.ink700, fontSize: 14 }}>{t.entityId}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: c.ink800 }}>
          {event.entityId}
        </span>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: c.ink700, fontSize: 14 }}>{t.severity}</span>
        <span style={{ fontWeight: 600, color: c.ink900, fontSize: 14 }}>{event.severity}</span>
      </Box>
      {event.batchId && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: c.ink700, fontSize: 14 }}>{t.batch}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: c.ink800 }}>
            {event.batchId}
          </span>
        </Box>
      )}
    </Box>
  );
}

function EventDrawerBody({
  event,
  onRollback,
}: {
  event: AuditEvent;
  onRollback?: (event: AuditEvent) => void;
}): React.JSX.Element {
  const t = useIntlayer('auditEventDrawer');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  const formatted = formatAuditEvent(event);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 3 }}>
      <Box
        sx={{
          border: '1px solid var(--color-info-soft-border)',
          bgcolor: 'var(--color-info-soft-bg)',
          p: 2,
        }}
      >
        <Typography variant="body2" fontWeight={600} style={{ color: '#1e3a5f' }}>
          {formatted.description}
        </Typography>
      </Box>
      <EventMetaRows event={event} formatted={formatted} />
      <Box>
        <Typography variant="body2" fontWeight={600} style={{ color: c.ink900 }}>
          {t.diff}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <DiffViewer diff={event.diff} />
        </Box>
      </Box>
      <details
        style={{ border: `1px solid ${c.border}`, background: 'var(--card-bg)', padding: 12 }}
      >
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: c.ink900 }}>
          {t.metadata}
        </summary>
        <Box sx={{ mt: 1, fontSize: 12, color: c.ink800 }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {event.meta ? JSON.stringify(event.meta, null, 2) : t.noMetadata}
          </pre>
        </Box>
      </details>
      {event.meta?.rollbackOf && (
        <Box
          sx={{
            border: `1px solid ${c.border}`,
            bgcolor: c.ink50,
            p: 1.5,
            fontSize: 14,
            color: c.ink800,
          }}
        >
          {t.rollbackOf}
          <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 12, color: c.ink900 }}>
            {event.meta.rollbackOf}
          </span>
        </Box>
      )}
      {event.isUndoable && (
        <button
          type="button"
          onClick={() => onRollback?.(event)}
          style={{
            width: '100%',
            border: `1px solid ${c.danger}`,
            background: c.dangerSoft,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: c.danger,
            cursor: 'pointer',
            borderRadius: tokens.radius.md,
          }}
        >
          {t.rollbackChange.value}
        </button>
      )}
    </Box>
  );
}

export function AuditEventDrawer({
  event,
  open,
  onClose,
  onRollback,
}: AuditEventDrawerProps): React.JSX.Element | null {
  const t = useIntlayer('auditEventDrawer');
  if (!event) {
    return null;
  }
  return (
    <DrawerShell isOpen={open} onClose={onClose} title={t.title.value} position="right" width="lg">
      <Box
        data-testid="audit-event-drawer-scroll"
        sx={{ minHeight: 0, flex: 1, overflowY: 'auto', pr: 0.5 }}
      >
        <EventDrawerBody event={event} onRollback={onRollback} />
      </Box>
    </DrawerShell>
  );
}
