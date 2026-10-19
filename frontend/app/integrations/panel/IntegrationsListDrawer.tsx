'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  PanelRow,
  PanelSearchField,
  PanelSectionLabel,
  PanelStatusDot,
} from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import {
  type IntegrationCategoryKey,
  type IntegrationEntry,
  useIntegrationCatalog,
} from './integration-catalog';

interface IntegrationsListDrawerProps {
  open: boolean;
  statuses: Record<string, boolean>;
  onSelect: (key: string) => void;
  onClose: () => void;
}

const CATEGORY_ORDER: IntegrationCategoryKey[] = [
  'ai',
  'application',
  'bank',
  'storage',
  'email',
  'messaging',
];

function useCategoryLabels(): Record<IntegrationCategoryKey, React.ReactNode> {
  const t = useIntlayer('integrationsPage');

  return {
    ai: t.categories.ai,
    application: t.categories.application,
    bank: t.categories.bank,
    storage: t.categories.storage,
    email: t.categories.email,
    messaging: t.categories.messaging,
  };
}

function matchesQuery(entry: IntegrationEntry, query: string): boolean {
  return `${entry.name} ${entry.description}`.toLowerCase().includes(query);
}

function CategoryGroup({
  label,
  entries,
  statuses,
  onSelect,
}: {
  label: React.ReactNode;
  entries: IntegrationEntry[];
  statuses: Record<string, boolean>;
  onSelect: (key: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('integrationsPage');

  return (
    <Box>
      <PanelSectionLabel>{label}</PanelSectionLabel>
      {entries.map(entry => (
        <PanelRow
          key={entry.key}
          icon={entry.icon}
          name={entry.name}
          description={entry.description}
          status={
            entry.statusPath ? (
              <PanelStatusDot
                connected={Boolean(statuses[entry.key])}
                label={statuses[entry.key] ? t.sections.connected.value : t.setUp.value}
              />
            ) : null
          }
          onClick={() => onSelect(entry.key)}
          dataAttributes={{
            'data-integration-card': entry.key,
            'data-tour-id': `integration-card-${entry.key}`,
          }}
        />
      ))}
    </Box>
  );
}

export function IntegrationsListDrawer({
  open,
  statuses,
  onSelect,
  onClose,
}: IntegrationsListDrawerProps): React.JSX.Element {
  const t = useIntlayer('integrationsPage');
  const categoryLabels = useCategoryLabels();
  const catalog = useIntegrationCatalog();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = query ? catalog.filter(entry => matchesQuery(entry, query)) : catalog;

    return CATEGORY_ORDER.map(category => ({
      category,
      entries: matching.filter(entry => entry.category === category),
    })).filter(group => group.entries.length > 0);
  }, [catalog, search]);

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="md"
      title={t.title}
      zIndex={1300}
    >
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}
        data-tour-id="integrations-available"
      >
        <PanelSearchField
          value={search}
          placeholder={t.searchPlaceholder.value}
          onChange={setSearch}
          tourId="integrations-search"
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          {groups.map(group => (
            <CategoryGroup
              key={group.category}
              label={categoryLabels[group.category]}
              entries={group.entries}
              statuses={statuses}
              onSelect={onSelect}
            />
          ))}

          {groups.length === 0 && (
            <Typography sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>
              {t.nothingMatches.value.replace('{query}', search)}
            </Typography>
          )}
        </Box>
      </Box>
    </DrawerShell>
  );
}
