'use client';

import Skeleton from '@mui/material/Skeleton';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from '@/app/components/icons';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { useIntlayer } from '@/app/i18n';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { avatarInitial, avatarTone } from '@/app/lib/initial-avatar';
import { type AuditEvent, isEntityType } from '@/lib/api/audit';
import { tokens } from '@/lib/theme-tokens';
import { ACTION_ICON_MAP } from '../utils/actionIconMap';
import { buildGroupedData } from '../utils/audit-table-utils';
import { formatAuditEvent } from '../utils/formatAuditEvent';
import { relativeTime } from '../utils/relativeTime';

interface AuditTimelineProps {
  events: AuditEvent[];
  onSelect: (event: AuditEvent) => void;
  onRollback?: (event: AuditEvent) => void;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * The member who acted, as the account menu shows them: their photo, or the
 * first letter of their name on the tint their e-mail picks. The system and
 * integrations have no member: their label's letter on a muted tint.
 */
function ActorAvatar({ event }: { event: AuditEvent }): React.JSX.Element {
  const [photoFailed, setPhotoFailed] = useState(false);
  const { actor } = event;
  const photo = normalizeAvatarUrl(actor?.avatarUrl);
  const tone = actor ? avatarTone(actor.email) : 'var(--muted-foreground)';
  return (
    <span className="audit-avatar" style={{ background: tone }} title={event.actorLabel}>
      {photo && !photoFailed ? (
        <img src={photo} alt="" onError={() => setPhotoFailed(true)} />
      ) : (
        avatarInitial(actor?.name || actor?.email || event.actorLabel)
      )}
    </span>
  );
}
function AuditTimelineItem({
  event,
  onSelect,
  onRollback,
}: {
  event: AuditEvent;
  onSelect: (e: AuditEvent) => void;
  onRollback?: (e: AuditEvent) => void;
}) {
  const t = useIntlayer('auditUi');
  const formatted = formatAuditEvent(event);
  const Icon = ACTION_ICON_MAP[event.action];
  const entityLabel = isEntityType(event.entityType)
    ? (t.entityLabels[event.entityType]?.value ?? event.entityType)
    : event.entityType;

  return (
    <li className="audit-item">
      <div className="audit-dot">{Icon && <Icon size={13} />}</div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: timeline items are supplemented by drawer */}
      <div
        className="audit-body"
        onClick={() => onSelect(event)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(event);
          }
        }}
      >
        <div className="audit-line">
          <ActorAvatar event={event} />
          <span className="audit-actor">{event.actorLabel}</span>
          <span className="audit-verb">{formatted.actionVerb}</span>
          <span className="audit-what">{entityLabel}</span>
          <span className="audit-tag">{entityLabel}</span>
        </div>
        <div className="audit-when">{relativeTime(event.createdAt)}</div>
      </div>

      {event.isUndoable && onRollback && (
        <button
          type="button"
          className="audit-rollback-btn"
          onClick={e => {
            e.stopPropagation();
            onRollback(event);
          }}
        >
          {t.rollback}
        </button>
      )}
    </li>
  );
}

function AuditBatchGroup({
  batchId,
  count,
  createdAt,
  expanded,
  onToggle,
}: {
  batchId: string;
  count: number;
  createdAt: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useIntlayer('auditUi');
  return (
    <li className="audit-item">
      <div className="audit-dot">
        <Layers size={13} />
      </div>
      <div className="audit-body">
        <button type="button" className="audit-batch-header" onClick={onToggle}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {t.batchSummary.value.replace('{count}', String(count))}
          <span className="audit-tag">{t.batch}</span>
        </button>
        <div className="audit-when">{relativeTime(createdAt)}</div>
      </div>
    </li>
  );
}

const SKELETON_ROW_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function AuditTimelineSkeleton(): React.JSX.Element {
  return (
    <ol className="audit-list">
      {SKELETON_ROW_KEYS.map(key => (
        <li className="audit-item" key={key}>
          <div className="audit-dot">
            <Skeleton variant="circular" width={13} height={13} />
          </div>
          <div className="audit-body">
            <div className="audit-line">
              <Skeleton variant="circular" width={22} height={22} className="audit-avatar" />
              <Skeleton variant="text" width={110} height={20} />
              <Skeleton variant="text" width={50} height={20} />
              <Skeleton variant="text" width={60} height={20} />
              <Skeleton
                variant="rounded"
                width={52}
                height={18}
                sx={{ borderRadius: tokens.radius.full }}
              />
            </div>
            <div className="audit-when">
              <Skeleton variant="text" width={64} height={16} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AuditTimeline({
  events,
  onSelect,
  onRollback,
  page,
  limit,
  total,
  onPageChange,
}: AuditTimelineProps) {
  const t = useIntlayer('auditUi');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const rows = useMemo(() => buildGroupedData(events, expandedBatches), [events, expandedBatches]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  if (rows.length === 0) {
    return (
      <div className="audit-empty">
        <EmptyStateIllustration name="activity" size="md" />
        {t.noEvents}
      </div>
    );
  }

  return (
    <>
      <ol className="audit-list">
        {rows.map(row => {
          if (row.type === 'group') {
            return (
              <AuditBatchGroup
                key={row.id}
                batchId={row.batchId}
                count={row.count}
                createdAt={row.createdAt}
                expanded={expandedBatches.has(row.batchId)}
                onToggle={() => toggleBatch(row.batchId)}
              />
            );
          }
          return (
            <AuditTimelineItem
              key={row.id}
              event={row.event}
              onSelect={onSelect}
              onRollback={onRollback}
            />
          );
        })}
      </ol>

      <div className="audit-pagination">
        <span>
          {t.pageOf.value.replace('{page}', String(page)).replace('{total}', String(totalPages))}
        </span>
        <AppPagination page={page} total={totalPages} onChange={onPageChange} />
      </div>
    </>
  );
}
