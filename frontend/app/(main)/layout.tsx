import type { ReactNode } from 'react';

import { AlertBanner } from '@/app/components/insights/AlertBanner';
import { DailyQuoteBanner } from '@/app/components/insights/DailyQuoteBanner';
import { MainSidePanelLayout } from '@/app/components/side-panel/MainSidePanelLayout';

export default function MainLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <MainSidePanelLayout>
      {/* Spacing and the page gutter live on the wrapper (.seneca-page-banners), so
          the banners line up with the page below whichever of them shows. */}
      <div className="seneca-page-banners">
        <AlertBanner />
        <DailyQuoteBanner />
      </div>
      {children}
    </MainSidePanelLayout>
  );
}
