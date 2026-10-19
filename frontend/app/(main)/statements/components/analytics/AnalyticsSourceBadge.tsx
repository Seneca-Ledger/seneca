'use client';

import type { SourceChannel } from '@/app/(main)/statements/components/shared-analytics.utils';
import { Bitcoin, Landmark, Mail, Receipt } from '@/app/components/icons';
import { getSourceLabel } from '@/app/lib/analytics-common';

type Props = {
  sourceChannel: SourceChannel;
  labels: {
    sourceBank: string;
    sourceReceipt: string;
    sourceGmailInbox: string;
    sourceCrypto: string;
  };
};

export function AnalyticsSourceBadge({ sourceChannel, labels }: Props): React.JSX.Element {
  const label = getSourceLabel(sourceChannel, labels);

  if (sourceChannel === 'gmail') {
    return (
      <span className="seneca-view-page__source-chip">
        <Mail size={14} />
        {label}
      </span>
    );
  }

  if (sourceChannel === 'crypto') {
    return (
      <span className="seneca-view-page__source-chip">
        <Bitcoin size={14} />
        {label}
      </span>
    );
  }

  if (sourceChannel === 'receipt') {
    return (
      <span className="seneca-view-page__source-chip">
        <Receipt size={14} />
        {label}
      </span>
    );
  }

  return (
    <span className="seneca-view-page__source-chip">
      <Landmark size={14} />
      {label}
    </span>
  );
}
