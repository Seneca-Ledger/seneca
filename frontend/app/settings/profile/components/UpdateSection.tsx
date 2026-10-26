'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Download, ExternalLink } from '@/app/components/icons';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import type { SystemUpdateStatus } from '@/app/lib/contracts';
import { useSystemUpdate } from '@/app/settings/profile/hooks/useSystemUpdate';

type Text = ReturnType<typeof useIntlayer<'updateSection'>>;

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

function stepText(t: Text, run: SystemUpdateStatus['run']): string {
  const tag = run.tag ?? '';
  switch (run.step) {
    case 'backup':
      return t.stepBackup.value;
    case 'pull':
      return fill(t.stepPull.value, { tag });
    case 'restart':
      return t.stepRestart.value;
    case 'health':
      return t.stepHealth.value;
    default:
      return t.stepQueued.value;
  }
}

function AvailableRelease({
  t,
  status,
  tag,
  startUpdate,
  starting,
}: {
  t: Text;
  status: SystemUpdateStatus;
  tag: string;
  startUpdate: () => void;
  starting: boolean;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2">{fill(t.available.value, { tag })}</Typography>
        {status.releaseUrl ? (
          <Link
            href={status.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            {t.releaseNotes.value}
            <ExternalLink size={14} />
          </Link>
        ) : null}
      </Stack>
      {status.updaterAvailable ? (
        <>
          <Box>
            <Button onClick={startUpdate} disabled={starting}>
              <Download size={16} />
              {fill(t.updateTo.value, { tag })}
            </Button>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t.updateHint.value}
          </Typography>
        </>
      ) : (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          {t.updaterOff.value}
        </Typography>
      )}
    </Stack>
  );
}

function FailedRun({ t, run }: { t: Text; run: SystemUpdateStatus['run'] }) {
  return (
    <Alert variant="error">
      <Stack spacing={0.5}>
        <span>{t.failed.value}</span>
        {run.message ? (
          <Box
            component="code"
            sx={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-word' }}
          >
            {run.message}
          </Box>
        ) : null}
        {run.backup ? <span>{fill(t.backupSaved.value, { file: run.backup })}</span> : null}
      </Stack>
    </Alert>
  );
}

function Muted({ children }: { children: string }) {
  return (
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * Running version and the in-app `make upgrade`, for instance admins. The
 * install itself is done by the opt-in updater container (`updater` profile).
 */
export function UpdateSection({ isAdmin }: { isAdmin: boolean }) {
  const t = useIntlayer('updateSection');
  const { status, installing, installed, startUpdate, starting } = useSystemUpdate(
    isAdmin,
    t.requestFailed.value,
  );

  if (!(isAdmin && status)) {
    return null;
  }

  const { currentVersion, latestVersion, run } = status;

  const progress = (() => {
    if (installed) {
      return <Muted>{fill(t.done.value, { tag: run.tag ?? '' })}</Muted>;
    }
    if (installing) {
      return (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
          }}
        >
          <Spinner size={16} />
          <Muted>{stepText(t, run)}</Muted>
        </Stack>
      );
    }
    if (status.updateAvailable && latestVersion) {
      return (
        <AvailableRelease
          t={t}
          status={status}
          tag={latestVersion}
          startUpdate={startUpdate}
          starting={starting}
        />
      );
    }
    return currentVersion ? <Muted>{t.upToDate.value}</Muted> : null;
  })();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
            }}
          >
            {currentVersion
              ? fill(t.running.value, { version: currentVersion })
              : t.localBuild.value}
          </Typography>
          {progress}
          {run.state === 'failed' && !installing ? <FailedRun t={t} run={run} /> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
