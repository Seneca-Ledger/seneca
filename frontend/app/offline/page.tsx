import { OfflineView } from './offline-view';

export const dynamic = 'force-static';

/**
 * Served by the service worker when a navigation has no network. Plain on
 * purpose: nothing here may depend on an API call.
 */
export default function OfflinePage() {
  return <OfflineView />;
}
