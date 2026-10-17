'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { isAxiosError } from 'axios';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ClockLineIcon } from '@/app/components/ui/empty-state-icons';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { OpenedWorkspaceVersion, WorkspaceVersion } from '@/app/lib/contracts';
import { formatStoredDateTime, formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { useVersions } from '@/app/settings/profile/hooks/useVersions';
import { tokens } from '@/lib/theme-tokens';

const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  );

/** Newest first, grouped by the month they were taken in. */
export function groupByMonth(
  versions: WorkspaceVersion[],
  locale: string,
): Array<{ month: string; versions: WorkspaceVersion[] }> {
  const groups: Array<{ month: string; versions: WorkspaceVersion[] }> = [];
  for (const version of versions) {
    const month = formatStoredDateWithOptions(
      version.takenAt,
      { month: 'long', year: 'numeric' },
      locale,
    );
    const last = groups[groups.length - 1];
    if (last?.month === month) last.versions.push(version);
    else groups.push({ month, versions: [version] });
  }
  return groups;
}

/** The newest ready version taken on or before the end of `day` (`yyyy-MM-dd`). */
export function versionOnOrBefore(
  versions: WorkspaceVersion[],
  day: string,
): WorkspaceVersion | null {
  const end = new Date(`${day}T23:59:59.999`).getTime();
  return (
    versions.find(
      version => version.status === 'ready' && new Date(version.takenAt).getTime() <= end,
    ) ?? null
  );
}

const formatSize = (bytes: number, locale: string): string => {
  const megabytes = bytes / 1_000_000;
  const [value, unit] = megabytes >= 1 ? [megabytes, 'megabyte'] : [bytes / 1000, 'kilobyte'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(
    value,
  );
};

type Props = {
  workspaceName: string;
  /** Opens the version read only and switches into it. */
  onOpen: (versionId: string) => Promise<void>;
  /** A version kept as an ordinary workspace. */
  onCopied: (copy: OpenedWorkspaceVersion) => void;
};

export function VersionsSection({ workspaceName, onOpen, onCopied }: Props): React.JSX.Element {
  const t = useIntlayer('settingsVersionsSection');
  const { locale } = useLocale();
  const { query, take, copy } = useVersions(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [copying, setCopying] = useState<WorkspaceVersion | null>(null);
  const [copyName, setCopyName] = useState('');

  const versions = query.data ?? [];
  const running = versions.some(version => version.status === 'running') || take.isPending;
  const ownerOnly =
    isAxiosError(query.error) &&
    query.error.response?.data?.error?.code === 'VERSION_LIST_OWNER_ONLY';

  const takeNow = () =>
    take.mutate(undefined, {
      onError: error => toast.error(getApiErrorMessage(error, t.takeError.value)),
    });

  const open = async (version: WorkspaceVersion) => {
    setOpening(version.id);
    try {
      await onOpen(version.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.loadError.value));
    } finally {
      setOpening(null);
    }
  };

  const startCopy = (version: WorkspaceVersion) => {
    const day = formatStoredDateWithOptions(
      version.takenAt,
      { day: 'numeric', month: 'short', year: 'numeric' },
      locale,
    );
    setCopyName(`${workspaceName} — ${day}`);
    setCopying(version);
  };

  const confirmCopy = () => {
    if (!copying) return;
    copy.mutate(
      { id: copying.id, name: copyName.trim() },
      {
        onSuccess: result => {
          setCopying(null);
          toast.success(fill(t.copied.value, { name: result.name }));
          onCopied(result);
        },
        onError: error => toast.error(getApiErrorMessage(error, t.takeError.value)),
      },
    );
  };

  const jumpTo = (day: string) => {
    if (!day) return;
    const target = versionOnOrBefore(versions, day);
    if (!target) {
      toast(t.noVersionBefore.value, { id: 'versions-jump' });
      return;
    }
    setHighlighted(target.id);
    document.getElementById(`version-${target.id}`)?.scrollIntoView({ block: 'center' });
  };

  if (ownerOnly) {
    return <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.ownerOnly}</Typography>;
  }

  if (query.isError) {
    return <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.loadError}</Typography>;
  }

  if (query.isSuccess && versions.length === 0) {
    return (
      <EmptyState
        compact
        icon={<ClockLineIcon />}
        title={t.emptyTitle}
        description={t.emptyDescription}
        action={
          <Button variant="outline" onClick={takeNow} disabled={running}>
            {running ? t.taking : t.takeNow}
          </Button>
        }
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="outline" onClick={takeNow} disabled={running}>
          {running ? t.taking : t.takeNow}
        </Button>
        <Box sx={{ width: 200 }}>
          <CustomDatePicker compact label={t.jumpTo.value} value="" onChange={jumpTo} />
        </Box>
      </Box>

      {groupByMonth(versions, locale).map(group => (
        <Box key={group.month} component="section" aria-label={group.month}>
          <Typography
            component="h3"
            sx={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', mb: 0.5 }}
          >
            {group.month}
          </Typography>
          {group.versions.map(version => (
            <VersionRow
              key={version.id}
              version={version}
              highlighted={highlighted === version.id}
              opening={opening === version.id}
              onOpen={() => open(version)}
              onCopy={() => startCopy(version)}
            />
          ))}
        </Box>
      ))}

      <ModalShell
        isOpen={copying !== null}
        onClose={() => setCopying(null)}
        title={t.copyTitle}
        size="sm"
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="ghost" onClick={() => setCopying(null)}>
              {t.cancel}
            </Button>
            <Button onClick={confirmCopy} disabled={!copyName.trim() || copy.isPending}>
              {t.save}
            </Button>
          </Box>
        }
      >
        <Typography sx={{ fontSize: 14, color: 'var(--text-muted)', mb: 2 }}>
          {t.copyHint}
        </Typography>
        <Typography component="label" htmlFor="version-copy-name" sx={{ fontSize: 13, mb: 0.5 }}>
          {t.copyName}
        </Typography>
        <TextField
          id="version-copy-name"
          fullWidth
          size="small"
          value={copyName}
          onChange={event => setCopyName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
        />
      </ModalShell>
    </Box>
  );
}

function VersionRow({
  version,
  highlighted,
  opening,
  onOpen,
  onCopy,
}: {
  version: WorkspaceVersion;
  highlighted: boolean;
  opening: boolean;
  onOpen: () => void;
  onCopy: () => void;
}): React.JSX.Element {
  const t = useIntlayer('settingsVersionsSection');
  const { locale } = useLocale();
  const counts = version.rowCounts;
  const documents = (counts.statements ?? 0) + (counts.receipts ?? 0);
  const details = [
    version.trigger === 'scheduled' ? t.nightly.value : t.manual.value,
    fill(t.transactions.value, { count: counts.transactions ?? 0 }),
    fill(t.documents.value, { count: documents }),
    formatSize(Number(version.sizeBytes), locale),
  ];

  return (
    <Box
      id={`version-${version.id}`}
      data-testid="version-row"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.25,
        px: 1,
        mx: -1,
        borderTop: '1px solid var(--border)',
        borderRadius: tokens.radius.sm,
        bgcolor: highlighted ? 'var(--surface-soft)' : 'transparent',
        '& .version-actions': { opacity: 0 },
        '&:hover .version-actions, &:focus-within .version-actions': { opacity: 1 },
        '@media (hover: none)': { '& .version-actions': { opacity: 1 } },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {formatStoredDateTime(version.takenAt, locale)}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {details.join(' · ')}
        </Typography>
      </Box>
      {version.status === 'ready' ? (
        <Box className="version-actions" sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={onOpen} disabled={opening}>
            {opening ? t.opening : t.open}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopy}>
            {t.saveCopy}
          </Button>
        </Box>
      ) : (
        <Box
          title={version.errorMessage ?? undefined}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, flexShrink: 0 }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: version.status === 'failed' ? 'var(--money-down)' : 'var(--attention)',
            }}
          />
          <Box component="span" sx={{ color: 'var(--text-muted)' }}>
            {version.status === 'failed' ? t.failed : t.preparing}
          </Box>
        </Box>
      )}
    </Box>
  );
}
