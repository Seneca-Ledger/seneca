import type { SidePanelProps, SidePanelSection } from './types';

export function filterSections({
  sections,
  enabledSections,
  permissions,
  hasPermission,
}: {
  sections: SidePanelSection[];
  enabledSections?: string[];
  permissions?: SidePanelProps['permissions'];
  hasPermission: (p: string) => boolean;
}): SidePanelSection[] {
  return sections.filter(s => {
    if (enabledSections && !enabledSections.includes(s.id)) return false;
    const req = permissions?.sections?.[s.id];
    return !req || req.every(p => hasPermission(p));
  });
}
