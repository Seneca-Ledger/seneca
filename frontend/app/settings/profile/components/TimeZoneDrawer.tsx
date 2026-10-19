'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Check, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import type { TimeZoneOption } from '@/app/settings/profile/profileHelpers';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  options: TimeZoneOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  labels: { title: string; placeholder: string; help: string };
};

/** Right-hand drawer with a searchable time-zone list. */
export function TimeZoneDrawer({
  isOpen,
  onClose,
  search,
  onSearchChange,
  options,
  selectedValue,
  onSelect,
  labels,
}: Props): React.JSX.Element {
  const t = useIntlayer('timeZoneDrawer');
  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={labels.title}
      position="right"
      width="sm"
      showCloseButton={false}
    >
      <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                pointerEvents: 'none',
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                color: 'text.secondary',
              }}
            >
              <Search size={16} />
            </Box>
            <Box
              component="input"
              id="profile-timezone"
              type="text"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onSearchChange(event.target.value)
              }
              placeholder={labels.placeholder}
              sx={{
                width: '100%',
                borderRadius: tokens.radius.md,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                py: 1.5,
                pl: 5,
                pr: 2,
                fontSize: 14,
                color: 'text.primary',
                '&:focus': { borderColor: 'primary.main' },
                boxSizing: 'border-box',
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {options.length > 0 ? (
              options.map(option => {
                const isSelected = option.value === selectedValue;
                return (
                  <Box
                    component="button"
                    key={option.value || '__auto'}
                    type="button"
                    onClick={() => onSelect(option.value)}
                    sx={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: tokens.radius.md,
                      px: 1.5,
                      py: 1.5,
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: 'none',
                      bgcolor: isSelected ? 'primary.light' : 'transparent',
                      color: isSelected ? 'primary.main' : 'text.primary',
                      '&:hover': { bgcolor: isSelected ? 'primary.light' : 'action.hover' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <Typography component="span" sx={{ fontWeight: 500, fontSize: 14 }}>
                      {option.label}
                    </Typography>
                    {isSelected ? <Check size={16} /> : null}
                  </Box>
                );
              })
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  borderRadius: tokens.radius.md,
                  bgcolor: 'background.paper',
                  px: 1.5,
                  py: 1.5,
                }}
              >
                {t.noResults.value}
              </Typography>
            )}
          </Box>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
        >
          {labels.help}
        </Typography>
      </Box>
    </DrawerShell>
  );
}
