'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import {
  CheckCircle2,
  Edit3,
  FileDown,
  FileUp,
  Link2,
  PlusCircle,
  RotateCcw,
  Trash2,
  Unlink2,
} from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import type { AuditEvent } from '@/lib/api/audit';
import { tokens } from '@/lib/theme-tokens';

interface EntityHistoryTimelineProps {
  events: AuditEvent[];
  onSelect?: (event: AuditEvent) => void;
}

type LucideIcon = typeof Edit3;

const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  create: PlusCircle,
  update: Edit3,
  delete: Trash2,
  import: FileUp,
  export: FileDown,
  rollback: RotateCcw,
  apply_rule: CheckCircle2,
  link: Link2,
  unlink: Unlink2,
};

function iconForAction(action: string): LucideIcon {
  return ACTION_ICON_MAP[action] ?? Edit3;
}

function TimelineEventItem({
  event,
  onSelect,
}: {
  event: AuditEvent;
  onSelect?: (event: AuditEvent) => void;
}): React.JSX.Element {
  const t = useIntlayer('auditUi');
  const Icon = iconForAction(event.action);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'flex-start',
        gap: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        padding: 12,
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: tokens.radius.lg,
      }}
    >
      <Box
        sx={{
          mt: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: tokens.radius.full,
          bgcolor: 'var(--muted)',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
        >
          <Typography variant="body2" fontWeight={600} style={{ color: 'var(--foreground)' }}>
            {event.action.replace(/_/g, ' ')}
          </Typography>
          <Typography variant="caption" style={{ color: 'var(--muted-foreground)' }}>
            {formatStoredDateTime(event.createdAt)}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}
        >
          {event.actorLabel} • {event.entityType} • {event.severity}
        </Typography>
        {event.batchId && (
          <Typography
            variant="caption"
            style={{ color: 'var(--muted-foreground)', display: 'block', marginTop: 4 }}
          >
            {t.batchId.value.replace('{id}', event.batchId)}
          </Typography>
        )}
      </Box>
    </button>
  );
}

export function EntityHistoryTimeline({
  events,
  onSelect,
}: EntityHistoryTimelineProps): React.JSX.Element {
  const t = useIntlayer('auditUi');
  if (!events.length) {
    return (
      <Typography variant="body2" style={{ color: 'var(--muted-foreground)' }}>
        {t.noHistory}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {events.map(event => (
        <TimelineEventItem key={event.id} event={event} onSelect={onSelect} />
      ))}
    </Box>
  );
}
