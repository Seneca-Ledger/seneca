'use client';

import type React from 'react';
import { AnalyticsDataProvider } from '@/app/(main)/statements/hooks/AnalyticsDataProvider';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';
import { TopCategoriesSection } from './TopCategoriesSection';
import { TopMerchantsSection } from './TopMerchantsSection';
import { TopSpendersSection } from './TopSpendersSection';

type Props = {
  /** The row an advice link rings; read once by the page, not per section. */
  focusId: string | null;
};

/**
 * The three leaderboards one under the other, each with its own month strip
 * and toggles. They all read the same statements and transactions, so the
 * provider loads them once for the tab instead of once per section.
 */
export function CashFlowTab({ focusId }: Props): React.JSX.Element {
  const { user } = useAuth();
  const { currentWorkspace, workspaces } = useWorkspace();
  const t = useIntlayer('statementsPage');
  const text = (path: string[], fallback: string): string =>
    resolveLabel(getNestedValue(t, path), fallback);

  return (
    <AnalyticsDataProvider
      user={user}
      currentWorkspace={currentWorkspace}
      workspaces={workspaces}
      workspaceFilter="current"
      currentWorkspaceLabel={text(['topSpenders', 'currentWorkspace'], 'Current workspace')}
      includeTransactions
      errorToastMessage={text(['topSpenders', 'loadError'], 'Failed to load spending data')}
    >
      <div className="lumio-cash-flow">
        <TopSpendersSection />
        <TopMerchantsSection focusId={focusId} />
        <TopCategoriesSection focusId={focusId} />
      </div>
    </AnalyticsDataProvider>
  );
}
