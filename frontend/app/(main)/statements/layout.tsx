import type { ReactNode } from 'react';

import { StatementsQueueProvider } from './components/statements-queue-context';

// Mounted once for every /statements route, so the queue counts behind the tab
// strip survive switching tabs instead of being refetched on each view.
export default function StatementsLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <StatementsQueueProvider>{children}</StatementsQueueProvider>;
}
