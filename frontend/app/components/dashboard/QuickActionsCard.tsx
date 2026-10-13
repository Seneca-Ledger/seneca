'use client';

import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import Link from 'next/link';
import type React from 'react';
import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { ChevronRight } from '@/app/components/icons';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer } from '@/app/i18n';
import { actionIcoClass, actionIcon, buildMappedActions } from './action-items';
import { CardEmpty, DashboardCard } from './ui';

const MAX_ACTIONS = 5;

interface QuickActionsCardProps {
  data: Pick<DashboardData, 'actions' | 'dataHealth'>;
}

export function QuickActionsCard({ data }: QuickActionsCardProps): React.JSX.Element {
  const t = useIntlayer('quickActionsCard');
  const actions = buildMappedActions(data, t.parsingIssuesFound.value);
  return (
    <DashboardCard title={t.title}>
      {actions.length === 0 ? (
        <CardEmpty icon={TaskAltOutlined}>{t.noActionsNeeded}</CardEmpty>
      ) : (
        <div className="lumio-dashboard__action-list">
          {actions.slice(0, MAX_ACTIONS).map(action => {
            const Icon = actionIcon(action.type);
            return (
              <Link key={action.type} href={action.href} className="lumio-dashboard__action-row">
                <div className={`lumio-dashboard__action-ico ${actionIcoClass(action.priority)}`}>
                  <Icon size={15} />
                </div>
                <div className="lumio-dashboard__action-body">
                  <div className="lumio-dashboard__action-title">{action.label}</div>
                  {action.count > 0 && (
                    <div className="lumio-dashboard__action-sub">
                      {fillTemplate(t.itemsToReview.value, { count: String(action.count) })}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className="lumio-dashboard__action-chevron" />
              </Link>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
