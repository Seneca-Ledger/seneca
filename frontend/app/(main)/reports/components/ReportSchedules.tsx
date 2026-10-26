'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';

type Cadence = 'daily' | 'weekly' | 'monthly';
type Format = 'pdf' | 'excel' | 'csv';

interface ReportScheduleRow {
  id: string;
  templateId: string;
  format: string;
  cadence: Cadence;
  recipients: string[];
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastError: string | null;
}

interface ReportSchedulesProps {
  /** Template ids, labels and formats, so the picker matches the Templates tab. */
  templates: Array<{ id: string; name: string; formats: Format[] }>;
}

const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly'];

const controlSx = {
  height: 36,
  fontSize: 12,
  bgcolor: 'var(--card)',
  borderRadius: tokens.radius.md,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted-foreground)',
};

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean);
}

export function ReportSchedules({ templates }: ReportSchedulesProps): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const { locale } = useLocale();
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;

  const [rows, setRows] = useState<ReportScheduleRow[]>([]);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 'pnl');
  const [format, setFormat] = useState<Format>('pdf');
  // Only the formats the chosen template can be written in; the server refuses the rest.
  const formats = templates.find(item => item.id === templateId)?.formats ?? ['pdf'];
  const selectedFormat = formats.includes(format) ? format : formats[0];
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const schedules = await apiQueryDecoded({
      url: '/reports/schedules',
      contract: 'ReportScheduleList',
    }).catch(() => []);
    setRows(schedules);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (): Promise<void> => {
    const recipients = parseRecipients(recipientsRaw);
    if (recipients.length === 0) {
      setError(text('scheduleNeedsRecipient', 'Add at least one email address'));
      return;
    }

    setSaving(true);
    setError(null);

    await (async () => {
      await apiClient.post('/reports/schedules', {
        templateId,
        format: selectedFormat,
        cadence,
        recipients,
        locale: locale as ContractInput<'CreateReportScheduleBody'>['locale'],
      } satisfies ContractInput<'CreateReportScheduleBody'>);
      setRecipientsRaw('');
      await load();
    })()
      .catch(async () => {
        setError(text('scheduleCreateFailed', 'Could not save the schedule'));
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const toggle = async (row: ReportScheduleRow): Promise<void> => {
    await apiClient.patch(`/reports/schedules/${row.id}`, {
      isActive: !row.isActive,
    } satisfies ContractInput<'UpdateReportScheduleActiveBody'>);
    await load();
  };

  const remove = async (row: ReportScheduleRow): Promise<void> => {
    await apiClient.delete(`/reports/schedules/${row.id}`);
    await load();
  };

  const templateName = (id: string): string => templates.find(tpl => tpl.id === id)?.name ?? id;

  return (
    <Box data-tour-id="reports-schedules">
      <Paper
        elevation={0}
        sx={{
          borderRadius: tokens.radius.lg,
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          p: 3,
          mb: 3,
        }}
      >
        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            color: 'var(--foreground)',
            mb: 0.25,
          }}
        >
          {text('scheduleNewTitle', 'Schedule a report')}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2.5, color: 'var(--muted-foreground)' }}>
          {text(
            'scheduleNewSubtitle',
            'Delivered by email at 06:00 your time, covering the last completed period',
          )}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <span style={labelStyle}>{text('scheduleTemplate', 'Report')}</span>
            <Select
              size="small"
              value={templateId}
              onChange={event => setTemplateId(event.target.value)}
              sx={controlSx}
            >
              {templates.map(tpl => (
                <MenuItem key={tpl.id} value={tpl.id} sx={{ fontSize: 12 }}>
                  {tpl.name}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <span style={labelStyle}>{text('scheduleCadence', 'Frequency')}</span>
            <Select
              size="small"
              value={cadence}
              onChange={event => setCadence(event.target.value as Cadence)}
              sx={controlSx}
            >
              {CADENCES.map(value => (
                <MenuItem key={value} value={value} sx={{ fontSize: 12 }}>
                  {text(`cadence_${value}`, value)}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <span style={labelStyle}>{text('format', 'Format')}</span>
            <Select
              size="small"
              value={selectedFormat}
              onChange={event => setFormat(event.target.value as Format)}
              sx={controlSx}
            >
              {formats.map(value => (
                <MenuItem key={value} value={value} sx={{ fontSize: 12 }}>
                  {value.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <span style={labelStyle}>{text('scheduleRecipients', 'Recipients')}</span>
            <TextField
              size="small"
              placeholder="finance@example.com"
              value={recipientsRaw}
              onChange={event => setRecipientsRaw(event.target.value)}
              slotProps={{
                input: { sx: controlSx },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            <Plus size={18} aria-hidden />
            {text('scheduleCreate', 'Create schedule')}
          </Button>
          {error && (
            <Typography variant="caption" sx={{ color: 'var(--destructive, #b33333)' }}>
              {error}
            </Typography>
          )}
        </Box>
      </Paper>

      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
          {text('scheduleEmpty', 'No scheduled reports yet')}
        </Typography>
      ) : (
        rows.map(row => (
          <Paper
            key={row.id}
            elevation={0}
            sx={{
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              bgcolor: 'var(--card)',
              p: 2,
              mb: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}
              >
                {templateName(row.templateId)} · {text(`cadence_${row.cadence}`, row.cadence)} ·{' '}
                {row.format.toUpperCase()}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                {row.recipients.join(', ')} — {text('scheduleNextRun', 'next run')}{' '}
                {new Date(row.nextRunAt).toLocaleString()}
              </Typography>
              {row.lastError && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', color: 'var(--destructive, #b33333)' }}
                >
                  {row.lastError}
                </Typography>
              )}
            </Box>

            <Switch
              size="small"
              checked={row.isActive}
              onChange={() => void toggle(row)}
              slotProps={{ input: { 'aria-label': text('scheduleActive', 'Active') } }}
            />
            <IconButton
              size="small"
              onClick={() => void remove(row)}
              aria-label={text('scheduleDelete', 'Delete schedule')}
            >
              <Trash2 size={16} />
            </IconButton>
          </Paper>
        ))
      )}
    </Box>
  );
}
