import type { ReactNode } from 'react';

import { StatementsQueueProvider } from './components/statements-queue-context';

// Mounted once for every /statements route, so the upload actions survive
// switching between Statements, Expenses and Income instead of reloading.
export default function StatementsLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <StatementsQueueProvider>{children}</StatementsQueueProvider>;
}
