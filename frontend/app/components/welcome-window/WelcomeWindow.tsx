'use client';

import type { SxProps, Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { Spinner } from '@/app/components/ui/spinner';
import { useWorkspaceActions } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { checkContract } from '@/app/lib/query-fn-schema';
import { greetingName } from './greeting-name';

export const UPLOAD_ROUTE = '/statements?upload=1';

interface WelcomeWindowProps {
  open: boolean;
  /** Closes the window and records it as seen; every way out goes through it. */
  onClose: () => void;
}

const paperSx = {
  width: '100%',
  maxWidth: 480,
  m: { xs: 0, sm: 2 },
  // A sheet from the bottom on a phone, a small card elsewhere.
  alignSelf: { xs: 'flex-end', sm: 'center' },
  borderRadius: { xs: '16px 16px 0 0', sm: '16px' },
  bgcolor: theme => (theme.palette.mode === 'dark' ? 'var(--card)' : 'var(--background)'),
  backgroundImage: 'none',
  boxShadow: 'none',
  border: '1px solid var(--border)',
  '& .MuiDialogTitle-root': {
    px: { xs: 2.5, sm: 3.5 },
    pt: { xs: 3, sm: 3.5 },
    pb: 1,
    alignItems: 'flex-start',
    gap: 2,
    fontSize: 28,
    fontWeight: 500,
    lineHeight: 1.2,
    color: 'var(--foreground)',
  },
} satisfies SxProps<Theme>;

const contentSx = {
  px: { xs: 2.5, sm: 3.5 },
  pb: { xs: 3, sm: 3.5 },
} satisfies SxProps<Theme>;

const subtitleSx = {
  fontSize: 16,
  lineHeight: 1.5,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

const actionsSx = {
  mt: 3.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
} satisfies SxProps<Theme>;

const actionSx = { minHeight: 44, fontSize: 15, fontWeight: 500 } satisfies SxProps<Theme>;

const skipSx = {
  ...actionSx,
  alignSelf: 'center',
  color: 'var(--text-muted)',
  '&:hover': { color: 'var(--foreground)' },
} satisfies SxProps<Theme>;

const errorSx = { mt: 1.5, fontSize: 14, color: 'var(--destructive)' } satisfies SxProps<Theme>;

function useTitle(): string {
  const t = useIntlayer('welcomeWindow');
  const { user } = useAuth();
  const name = greetingName(user?.name);
  // A function, so a `$` in the name is not read as a replacement pattern.
  return name ? t.title.value.replace('{{name}}', () => name) : t.titleNoName.value;
}

/** Creates the demo workspace, opens it and goes to the overview. */
function useOpenDemo(onClose: () => void): {
  open: () => Promise<void>;
  busy: boolean;
  failed: boolean;
} {
  const t = useIntlayer('welcomeWindow');
  const router = useRouter();
  const { switchWorkspace } = useWorkspaceActions();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await apiClient.post('/workspaces/demo', { name: t.demoName.value });
      const { id } = await checkContract('WorkspaceSummary', response.data, '/workspaces/demo');
      await switchWorkspace(id);
      onClose();
      router.push(DEFAULT_APP_ROUTE);
    } catch {
      // The window stays open with a line under the buttons; the person can try
      // again or take another way in.
      setFailed(true);
      setBusy(false);
    }
  };
  return { open, busy, failed };
}

/**
 * What a new account sees first: one small window with three ways in. The guide
 * to every page is in Settings; each page explains itself with its own hints.
 */
export default function WelcomeWindow({ open, onClose }: WelcomeWindowProps): React.JSX.Element {
  const t = useIntlayer('welcomeWindow');
  const router = useRouter();
  const title = useTitle();
  const demo = useOpenDemo(onClose);

  const upload = (): void => {
    onClose();
    router.push(UPLOAD_ROUTE);
  };
  // While the demo is being built, closing would leave it half-done in the background.
  const close = (): void => {
    if (!demo.busy) {
      onClose();
    }
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={close}
      title={title}
      size="sm"
      closeOnBackdropClick={false}
      paperSx={paperSx}
      contentSx={contentSx}
    >
      <Typography sx={subtitleSx}>{t.subtitle}</Typography>
      <Box sx={actionsSx}>
        <Button
          variant="contained"
          size="large"
          onClick={upload}
          disabled={demo.busy}
          sx={actionSx}
        >
          {t.upload}
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => void demo.open()}
          disabled={demo.busy}
          aria-busy={demo.busy}
          startIcon={demo.busy ? <Spinner size={16} /> : undefined}
          sx={actionSx}
        >
          {t.demo}
        </Button>
        <Button variant="text" onClick={close} disabled={demo.busy} sx={skipSx}>
          {t.skip}
        </Button>
      </Box>
      {demo.failed && (
        <Typography role="alert" sx={errorSx}>
          {t.demoError}
        </Typography>
      )}
    </ModalShell>
  );
}
