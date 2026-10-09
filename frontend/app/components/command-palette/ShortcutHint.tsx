'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Kbd } from '@/app/components/ui/kbd';
import { useIntlayer } from '@/app/i18n';
import { bindingToTokens } from './shortcut-display';
import { useIsMacPlatform } from './use-is-mac-platform';

/** The key caps drawn at the end of a palette row, e.g. `G then A`. */
export function ShortcutHint({ binding }: { binding: string }): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const isMac = useIsMacPlatform();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
      {bindingToTokens(binding, isMac).map((token, index) =>
        token.kind === 'sep' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
          <Typography key={index} variant="caption" sx={{ color: 'text.secondary' }}>
            {t.chordThen}
          </Typography>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
          <Kbd key={index}>{token.text}</Kbd>
        ),
      )}
    </Box>
  );
}
