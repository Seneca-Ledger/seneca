'use client';

import { useQuery } from '@tanstack/react-query';
import type React from 'react';

import { DashboardCard } from '@/app/components/dashboard/ui/DashboardCard';
import { useHouseholdMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { apiQuery } from '@/app/lib/query-fn';
import { formatStoredDateTime } from '@/app/lib/user-format-store';

/** Short: the point is "recently", and the full audit is a page of its own. */
const ACTIVITY_LIMIT = 8;
const ACTIVITY_STALE_TIME = 60 * 1000;

interface ActivityEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string | null;
  createdAt: string;
}

/**
 * Who in the household moved what, lately.
 *
 * Hidden for a workspace of one: with nobody else to have done it, every line
 * would read "you did this", which the rest of the dashboard already shows.
 */
export function WorkspaceActivityCard(): React.JSX.Element | null {
  const workspaceId = useWorkspaceId();
  const members = useHouseholdMembers();
  const t = useIntlayer('workspaceActivity');
  const { locale } = useLocale();

  const { data } = useQuery({
    queryKey: ['workspace-activity', workspaceId, ACTIVITY_LIMIT],
    queryFn: ({ signal }) =>
      apiQuery<{ items: ActivityEntry[] }>({
        url: '/audit-events/activity',
        params: { limit: ACTIVITY_LIMIT },
        signal,
      }),
    staleTime: ACTIVITY_STALE_TIME,
    enabled: Boolean(workspaceId) && members.length > 0,
  });

  if (members.length === 0) {
    return null;
  }

  const items = data?.items ?? [];

  return (
    <DashboardCard title={t.title.value}>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>{t.empty.value}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {items.map(item => (
            <li
              key={item.id}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}
            >
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{item.actorName}</span>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--muted-foreground)' }}>
                {item.description ?? `${item.action} ${item.entityType}`}
              </span>
              <span
                style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
              >
                {formatStoredDateTime(item.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
