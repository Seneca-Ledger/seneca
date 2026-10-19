'use client';

import Skeleton from '@mui/material/Skeleton';
import { tokens } from '@/lib/theme-tokens';

function CheckboxPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        height: 16,
        width: 16,
        borderRadius: tokens.radius.sm,
        border: '1px solid var(--border-color)',
        background: 'var(--muted)',
      }}
    />
  );
}

function MobileSkeletonContent(): React.JSX.Element {
  return (
    <div style={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" height={16} />
      <div
        style={{
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Skeleton variant="text" width={80} height={14} />
        <Skeleton variant="text" width={70} height={14} />
      </div>
    </div>
  );
}

function GmailSyncSkeletonRowMobile(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <CheckboxPlaceholder />
      <div style={{ width: 40 }}>
        <Skeleton variant="rounded" width={34} height={34} />
      </div>
      <MobileSkeletonContent />
    </div>
  );
}

function DesktopSkeletonRight(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 24,
        flexShrink: 0,
        width: 420,
        paddingLeft: 16,
      }}
    >
      <div style={{ width: 128, textAlign: 'right' }}>
        <Skeleton variant="text" width={90} height={20} />
      </div>
      <div style={{ width: 144, display: 'flex', justifyContent: 'flex-end' }}>
        <Skeleton variant="rounded" width={72} height={30} />
      </div>
    </div>
  );
}

function DesktopSkeletonLeft(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          marginRight: 16,
        }}
      >
        <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
          <CheckboxPlaceholder />
        </div>
        <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton variant="rounded" width={28} height={28} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" width="45%" height={18} />
        <Skeleton variant="text" width="25%" height={14} />
      </div>
    </div>
  );
}

function GmailSyncSkeletonRowDesktop(): React.JSX.Element {
  return (
    <>
      <DesktopSkeletonLeft />
      <DesktopSkeletonRight />
    </>
  );
}

interface StatementsGmailSyncProps {
  gmailSyncSkeletonKeys: string[];
}

export function StatementsGmailSync({
  gmailSyncSkeletonKeys,
}: StatementsGmailSyncProps): React.JSX.Element | null {
  if (gmailSyncSkeletonKeys.length === 0) {
    return null;
  }

  return (
    <>
      {gmailSyncSkeletonKeys.map(key => (
        <div
          key={key}
          data-testid="gmail-sync-skeleton-row"
          className="seneca-stmt-list-view__skeleton-row"
        >
          <div className="seneca-stmt-list-view__skeleton-mobile">
            <GmailSyncSkeletonRowMobile />
          </div>
          <div className="seneca-stmt-list-view__skeleton-desktop">
            <GmailSyncSkeletonRowDesktop />
          </div>
        </div>
      ))}
    </>
  );
}
