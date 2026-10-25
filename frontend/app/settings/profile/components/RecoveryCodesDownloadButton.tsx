'use client';

import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Download, FileText } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useLocale } from '@/app/i18n';
import { APP_NAME } from '@/app/lib/brand';
import { formatDateTime, type UserFormatPreferences } from '@/app/lib/user-format';
import {
  downloadRecoveryCodes,
  type RecoveryCodesFileFormat,
} from '@/app/settings/profile/helpers/recovery-codes-file';
import type { Tx } from '@/app/settings/profile/hooks/useSettingsText';

const FORMATS: Array<{ format: RecoveryCodesFileFormat; label: string }> = [
  { format: 'pdf', label: 'PDF' },
  { format: 'docx', label: 'Word (.docx)' },
];

type Props = {
  tx: Tx;
  codes: string[];
  email: string;
  formatPreferences: UserFormatPreferences;
};

export function RecoveryCodesDownloadButton({
  tx,
  codes,
  email,
  formatPreferences,
}: Props): React.JSX.Element {
  const { locale } = useLocale();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = (format: RecoveryCodesFileFormat): void => {
    setMenuAnchor(null);
    setDownloading(true);
    downloadRecoveryCodes(format, {
      locale,
      title: `${APP_NAME} — ${tx(['securityCard', 'recoveryTitle'], 'Recovery codes')}`,
      details: [
        `${tx(['securityCard', 'fileAccount'], 'Account')}: ${email}`,
        `${tx(['securityCard', 'fileGenerated'], 'Generated')}: ${formatDateTime(new Date(), formatPreferences)}`,
      ],
      hint: tx(
        ['securityCard', 'fileHint'],
        "Each code works once instead of a code from your authenticator app. Keep this file somewhere safe and don't share it.",
      ),
      codes,
    })
      .catch(error => {
        console.error('Failed to build the recovery codes file', error);
        toast.error(
          tx(
            ['securityCard', 'downloadError'],
            "Couldn't create the file — copy the codes instead.",
          ),
        );
      })
      .finally(() => setDownloading(false));
  };

  return (
    <>
      <Button
        variant="outlined"
        disabled={downloading}
        aria-haspopup="menu"
        aria-expanded={menuAnchor ? 'true' : undefined}
        onClick={event => setMenuAnchor(event.currentTarget)}
        startIcon={downloading ? <Spinner size={16} /> : <Download size={16} />}
        endIcon={<ChevronDown size={16} />}
      >
        {tx(['securityCard', 'downloadButton'], 'Download')}
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {FORMATS.map(item => (
          <MenuItem key={item.format} onClick={() => handleDownload(item.format)}>
            <ListItemIcon>
              <FileText size={16} />
            </ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
