'use client';

import type { SidePanelSection } from '../types';
import { ActionsSectionRenderer } from './ActionsSection';
import { ChartSectionRenderer } from './ChartSection';
import { CustomSectionRenderer } from './CustomSection';
import { ErrorSectionRenderer } from './ErrorSection';
import { MetricsSectionRenderer } from './MetricsSection';
import { NavigationSectionRenderer } from './NavigationSection';
import { SettingsSectionRenderer } from './SettingsSection';
import { StatusSectionRenderer } from './StatusSection';
import { SummarySectionRenderer } from './SummarySection';

export {
  ActionsSectionRenderer,
  ChartSectionRenderer,
  CustomSectionRenderer,
  ErrorSectionRenderer,
  MetricsSectionRenderer,
  NavigationSectionRenderer,
  SettingsSectionRenderer,
  StatusSectionRenderer,
  SummarySectionRenderer,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTION_RENDERERS: Record<string, React.ComponentType<{ section: any }>> = {
  navigation: NavigationSectionRenderer,
  status: StatusSectionRenderer,
  summary: SummarySectionRenderer,
  metrics: MetricsSectionRenderer,
  actions: ActionsSectionRenderer,
  settings: SettingsSectionRenderer,
  error: ErrorSectionRenderer,
  chart: ChartSectionRenderer,
  custom: CustomSectionRenderer,
};

export function SectionRenderer({
  section,
}: {
  section: SidePanelSection;
}): React.JSX.Element | null {
  const Renderer = SECTION_RENDERERS[section.type];
  if (!Renderer) return null;
  return <Renderer section={section} />;
}
