'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from 'next-themes';
import { Cloud, Download, Folder } from '@/app/components/icons';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { APP_SLUG } from '@/app/lib/brand';
import { BackupSection } from '@/app/settings/profile/components/BackupSection';
import type { BankStat } from '@/app/settings/profile/hooks/useSync';
import { tokens } from '@/lib/theme-tokens';

const BANK_LABELS: Record<string, string> = {
  bereke_new: 'Bereke Bank (new)',
  bereke_old: 'Bereke Bank (old)',
  kaspi: 'Kaspi Bank',
  hapoalim: 'Bank Hapoalim',
  absa: 'Absa Bank',
  ally: 'Ally Bank',
  anz: 'ANZ',
  associated: 'Associated Bank',
  atb: 'ATB Financial',
  axis: 'Axis Bank',
  banco_do_brasil: 'Banco do Brasil',
  bank_of_china: 'Bank of China (Hong Kong)',
  bank_of_scotland: 'Bank of Scotland',
  barclays: 'Barclays',
  other: 'Other',
};

type Props = {
  bankStats: BankStat[];
  totalCount: number;
  statsLoading: boolean;
  downloading: boolean;
  errorMessage: string | null;
  handleExportZip: () => void;
};

export function SyncSection({
  bankStats,
  totalCount,
  statsLoading,
  downloading,
  errorMessage,
  handleExportZip,
}: Props) {
  const t = useIntlayer('settingsSyncSection');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  return (
    <Stack spacing={2.5}>
      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

      {/* Description */}
      <Card variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
            }}
          >
            {t.title.value}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.5,
            }}
          >
            {t.intro.value}
          </Typography>
        </Box>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Cloud size={18} style={{ color: c.ink400 }} />
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.foldersIntro.value}
            </Typography>
          </Box>

          {/* Folder structure preview */}
          <Box
            sx={{
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              px: 2,
              py: 1.5,
              fontFamily: 'monospace',
              fontSize: 13,
              color: 'text.secondary',
              mb: 2.5,
            }}
          >
            {statsLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Spinner size={14} />
                <span>{t.loadingStructure.value}</span>
              </Box>
            ) : (
              <Stack spacing={0.25}>
                <span>{APP_SLUG}-export.zip</span>
                {bankStats.map(({ bank, count }) => (
                  <Box key={bank} sx={{ pl: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Folder size={13} />
                      <span>{bank}/</span>
                      <Chip label={count} size="small" sx={{ height: 16, fontSize: 11 }} />
                    </Box>
                  </Box>
                ))}
                {bankStats.length === 0 && (
                  <Box sx={{ pl: 2, color: 'text.disabled' }}>
                    <span>{t.noFilesYet.value}</span>
                  </Box>
                )}
              </Stack>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleExportZip}
              disabled={downloading || totalCount === 0}
              startIcon={downloading ? <Spinner size={16} /> : <Download size={16} />}
            >
              {downloading
                ? t.exporting.value
                : totalCount > 0
                  ? t.exportZipCount.value.replace('{count}', String(totalCount))
                  : t.exportZip.value}
            </Button>
            {totalCount === 0 && !statsLoading && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.disabled',
                }}
              >
                {t.noFilesToExport.value}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
      <BackupSection />
    </Stack>
  );
}
