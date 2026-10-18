'use client';

import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { WebhookEventName } from '@/app/lib/contracts';
import { EVENT_LABEL_KEY, WEBHOOK_EVENT_GROUPS, type WebhookEventGroup } from './webhook-events';

/** Every event a subscription can listen to, in the groups the contract defines. */
export function WebhookEventPicker({
  selected,
  onToggle,
}: {
  selected: readonly WebhookEventName[];
  onToggle: (event: WebhookEventName) => void;
}): React.JSX.Element {
  const t = useIntlayer('webhooksDrawer');
  const groups = Object.entries(WEBHOOK_EVENT_GROUPS) as Array<
    [WebhookEventGroup, readonly WebhookEventName[]]
  >;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {groups.map(([group, events]) => (
        <Box key={group} role="group" aria-label={t.groups[group].value}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {t.groups[group]}
          </Typography>
          {events.map(event => (
            <FormControlLabel
              key={event}
              sx={{ display: 'flex', ml: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={selected.includes(event)}
                  onChange={() => onToggle(event)}
                />
              }
              label={
                <Typography sx={{ fontSize: 13 }}>
                  {t.events[EVENT_LABEL_KEY[event]].value}
                </Typography>
              }
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
