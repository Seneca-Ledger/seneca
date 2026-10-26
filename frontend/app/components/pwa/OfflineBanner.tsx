'use client';

import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { useOfflineQueue } from '@/app/lib/offline/useOfflineQueue';

/** A thin strip when the network is gone or entries are waiting to be sent. */
export function OfflineBanner(): React.JSX.Element | null {
  const t = useIntlayer('offlineBanner');
  const { online, count, replaying, flush } = useOfflineQueue();
  if (online && count === 0) return null;
  const text = !online
    ? count > 0
      ? t.offlineWithQueue.value.replace('{{count}}', String(count))
      : t.offline.value
    : t.queued.value.replace('{{count}}', String(count));
  return (
    <div
      role="status"
      className={`seneca-offline-banner${online ? '' : ' seneca-offline-banner--offline'}`}
    >
      <span>{text}</span>
      {online && count > 0 && (
        <button
          type="button"
          className="seneca-offline-banner__action"
          disabled={replaying}
          onClick={() => void flush()}
        >
          {replaying ? t.sending : t.sendNow}
        </button>
      )}
    </div>
  );
}
