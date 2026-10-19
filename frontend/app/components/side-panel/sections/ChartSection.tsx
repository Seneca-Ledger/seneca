'use client';

import type { ChartSection } from '../types';
import { SectionWrapper } from './components/SectionWrapper';
import { ChartItemComponent } from './MetricsSection';

export function ChartSectionRenderer({ section }: { section: ChartSection }): React.JSX.Element {
  return (
    <SectionWrapper section={section}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {section.items.map(item => (
          <ChartItemComponent key={item.id} item={item} />
        ))}
      </div>
    </SectionWrapper>
  );
}
