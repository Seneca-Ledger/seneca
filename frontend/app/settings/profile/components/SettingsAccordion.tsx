'use client';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { ChevronDown } from '@/app/components/icons';
import type { SettingsSectionId } from '@/app/settings/profile/helpers/settings-url-state';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  id: SettingsSectionId;
  title: string;
  description?: string;
  icon?: ComponentType<{ size?: number }>;
  defaultExpanded?: boolean;
  'data-tour-id'?: string;
  children: ReactNode;
};

export const settingsSectionDomId = (id: SettingsSectionId): string => `settings-section-${id}`;

/**
 * One collapsible panel inside a settings tab. Uncontrolled on purpose: the
 * tab remounts on every tab change, and the only outside input (`?section=`)
 * arrives with the page load.
 */
export function SettingsAccordion({
  id,
  title,
  description,
  icon: Icon,
  defaultExpanded = false,
  'data-tour-id': tourId,
  children,
}: Props): React.JSX.Element {
  return (
    <Accordion
      id={settingsSectionDomId(id)}
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      data-tour-id={tourId}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: `${tokens.radius.md} !important`,
        bgcolor: 'background.paper',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={20} />}
        sx={{ px: 2, minHeight: 56, '& .MuiAccordionSummary-content': { my: 1.5, minWidth: 0 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {Icon ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <Icon size={18} />
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {title}
            </Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
