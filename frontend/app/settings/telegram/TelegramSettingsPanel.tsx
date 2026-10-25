'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Send, Bot as TelegramIcon } from '@/app/components/icons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { TelegramConnection, TelegramLink } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import { SharedTelegramBotCard } from './SharedTelegramBotCard';

type ReportStatus = 'pending' | 'sent' | 'failed';
type ReportType = 'daily' | 'monthly' | 'custom';

interface TelegramReport {
  id: string;
  chatId: string;
  reportType: ReportType;
  reportDate: string;
  status: ReportStatus;
  sentAt?: string | null;
  createdAt: string;
}

// How often the panel asks whether Start was pressed, while a link is open.
const CONNECTION_POLL_MS = 2000;

const loadConnection = async (): Promise<TelegramConnection | null> =>
  apiQueryDecoded({ url: '/telegram/connection', contract: 'TelegramConnection' }).catch(
    async err => {
      console.error('Failed to load telegram connection', err);
      return null;
    },
  );

/**
 * Telegram bot + chat wiring and the report history. Rendered inside the
 * Notifications settings tab, after the page's own auth gate.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function TelegramSettingsPanel({ isAdmin }: { isAdmin: boolean }): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const t = useIntlayer('settingsTelegramPage');
  const { locale } = useLocale();

  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  // The link opened by Connect, while the panel waits for Start in Telegram.
  const [pendingLink, setPendingLink] = useState<TelegramLink | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<TelegramReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [sendingDaily, setSendingDaily] = useState(false);
  const [sendingMonthly, setSendingMonthly] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botTimeoutMs, setBotTimeoutMs] = useState('10000');
  // The workspace's own bot, and a shared one (an admin's, or TELEGRAM_BOT_TOKEN).
  const [ownBot, setOwnBot] = useState(false);
  const [sharedBot, setSharedBot] = useState(false);
  const botConfigured = ownBot || sharedBot;
  const [savingBot, setSavingBot] = useState(false);

  const formatTelegramDate = (dateString: string | null | undefined): string => {
    if (!dateString) return t.history.dash.value;
    const date = new Date(dateString);
    return formatStoredDateTime(date, locale);
  };

  const getReportTypeLabel = (type: ReportType): string => {
    switch (type) {
      case 'daily':
        return t.reportType.daily.value;
      case 'monthly':
        return t.reportType.monthly.value;
      default:
        return t.reportType.custom.value;
    }
  };

  const getStatusLabel = (status: ReportStatus): string => {
    switch (status) {
      case 'sent':
        return t.reportStatus.sent.value;
      case 'failed':
        return t.reportStatus.failed.value;
      default:
        return t.reportStatus.pending.value;
    }
  };

  const loadReports = async (): Promise<void> => {
    await (async () => {
      setLoadingReports(true);
      // Not apiQueryDecoded: it would unwrap `data` and check the rows against the page.
      const response = await apiClient.get('/telegram/reports');
      const page = await checkContract('TelegramReportPage', response.data, '/telegram/reports');
      setReports(page.data);
    })()
      .catch(async err => {
        console.error('Failed to load telegram reports', err);
      })
      .finally(async () => {
        setLoadingReports(false);
      });
  };

  const loadBotSettings = async (): Promise<void> => {
    await (async () => {
      const bot = await apiQueryDecoded({
        url: '/settings/notifications/telegram',
        contract: 'TelegramBotStatus',
      });
      setOwnBot(bot.source === 'workspace');
      setSharedBot(bot.settings.sharedBot);
      setBotTimeoutMs(String(bot.settings.timeoutMs || 10000));
    })().catch(async err => {
      console.error('Failed to load telegram bot settings', err);
    });
  };

  useEffect(() => {
    void loadReports();
    void loadBotSettings();
    void loadConnection().then(setConnection);
  }, []);

  // While a link is open, wait for the bot to see Start, until the link expires.
  useEffect(() => {
    if (!pendingLink) {
      return;
    }
    const timer = setInterval(() => {
      if (Date.now() > Date.parse(pendingLink.expiresAt)) {
        setPendingLink(null);
        setError(t.connect.expired.value);
        return;
      }
      void loadConnection().then(next => {
        if (next?.inThisWorkspace) {
          setConnection(next);
          setPendingLink(null);
          setStatusMessage(t.messages.connected.value);
        }
      });
    }, CONNECTION_POLL_MS);
    return () => clearInterval(timer);
  }, [pendingLink, t.connect.expired.value, t.messages.connected.value]);

  const saveBotSettings = async (): Promise<void> => {
    await (async () => {
      setSavingBot(true);
      setStatusMessage(null);
      setError(null);
      await apiClient.put('/settings/notifications/telegram', {
        botToken,
        timeoutMs: Number(botTimeoutMs) || 10000,
      } satisfies ContractInput<'SaveTelegramSettingsBody'>);
      setBotToken('');
      setOwnBot(true);
      setStatusMessage(t.bot.saved.value);
    })()
      .catch(async err => {
        const message = getApiErrorMessage(err, t.bot.saveFailed.value);
        setError(message);
      })
      .finally(async () => {
        setSavingBot(false);
      });
  };

  const connectTelegram = async (): Promise<void> => {
    setStatusMessage(null);
    setError(null);
    // Opened before the request: a tab opened after an await counts as a popup.
    const tab = window.open('', '_blank');
    await (async () => {
      setLoading(true);
      const response = await apiClient.post('/telegram/link');
      const link = await checkContract('TelegramLink', response.data, '/telegram/link');
      if (tab) {
        tab.opener = null;
        tab.location.href = link.url;
      }
      setPendingLink(link);
    })()
      .catch(async err => {
        tab?.close();
        const message = getApiErrorMessage(err, t.errors.connectFailed.value);
        setError(message);
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const disconnectTelegram = async (): Promise<void> => {
    await (async () => {
      setLoading(true);
      setStatusMessage(null);
      setError(null);
      await apiClient.delete('/telegram/connection');
      setConnection(await loadConnection());
    })()
      .catch(async err => {
        const message = getApiErrorMessage(err, t.errors.disconnectFailed.value);
        setError(message);
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const sendReport = async (type: ReportType): Promise<void> => {
    const setSending = type === 'daily' ? setSendingDaily : setSendingMonthly;
    setSending(true);
    setError(null);
    setStatusMessage(null);

    await (async () => {
      await apiClient.post('/telegram/send-report', {
        reportType: type,
      } satisfies ContractInput<'SendTelegramReportBody'>);
      setStatusMessage(t.messages.sent.value);
      await loadReports();
    })()
      .catch(async err => {
        const message = getApiErrorMessage(err, t.errors.sendFailed.value);
        setError(message);
      })
      .finally(async () => {
        setSending(false);
      });
  };

  // The tab hides this panel for roles without the permission; this only
  // matters if the panel is ever rendered on its own.
  if (!hasPermission('telegram.view')) {
    return <Alert severity="warning">{t.permissionRequired.value}</Alert>;
  }

  return (
    <Stack spacing={3}>
      {(statusMessage || error) && (
        <Box>
          {statusMessage && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {statusMessage}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      )}

      {isAdmin && <SharedTelegramBotCard onChange={() => void loadBotSettings()} />}

      {/* People with a shared bot only press Connect; admins and owners of a workspace bot still see it. */}
      {(isAdmin || !sharedBot || ownBot) && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t.bot.title.value}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t.bot.description.value}
              </Typography>
              {sharedBot && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t.bot.overrideHint.value}
                </Typography>
              )}
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="password"
                label={t.bot.tokenLabel.value}
                placeholder={ownBot ? t.bot.tokenPlaceholderConfigured.value : '123456:ABC'}
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
              />
              <TextField
                fullWidth
                label={t.bot.timeoutLabel.value}
                value={botTimeoutMs}
                onChange={e => setBotTimeoutMs(e.target.value)}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                startIcon={<CheckCircle size={18} />}
                onClick={saveBotSettings}
                disabled={savingBot || !(ownBot || botToken)}
              >
                {savingBot ? t.bot.checking.value : ownBot ? t.bot.update.value : t.bot.save.value}
              </Button>
              {ownBot && (
                <Chip
                  icon={<TelegramIcon size={16} />}
                  color="success"
                  label={t.bot.configured.value}
                  variant="outlined"
                />
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t.connect.title.value}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.connect.steps.value}
            </Typography>
          </Box>

          {connection?.connected && !connection.inThisWorkspace && (
            <Alert severity="info">{t.connect.connectedElsewhere.value}</Alert>
          )}

          {connection?.inThisWorkspace ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                alignItems: 'center',
              }}
            >
              <Chip
                icon={<TelegramIcon size={16} />}
                color="success"
                label={t.connect.connectedHere.value}
                variant="outlined"
              />
              {hasPermission('telegram.connect') && (
                <Button variant="outlined" onClick={disconnectTelegram} disabled={loading}>
                  {t.connect.disconnect.value}
                </Button>
              )}
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                  alignItems: 'center',
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<TelegramIcon size={18} />}
                  onClick={connectTelegram}
                  disabled={loading || !botConfigured || !hasPermission('telegram.connect')}
                >
                  {t.connect.button.value}
                </Button>
                {pendingLink && (
                  <Button
                    variant="text"
                    href={pendingLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.connect.openTelegram.value}
                  </Button>
                )}
              </Stack>
              {pendingLink && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t.connect.waiting.value}
                </Typography>
              )}
              {!botConfigured && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t.connect.botMissing.value}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack
          spacing={2}
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t.quickSend.title.value}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.quickSend.subtitle.value}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Send />}
              onClick={() => sendReport('daily')}
              disabled={sendingDaily || !connection?.inThisWorkspace}
            >
              {t.quickSend.sendToday.value}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Clock size={18} />}
              onClick={() => sendReport('monthly')}
              disabled={sendingMonthly || !connection?.inThisWorkspace}
            >
              {t.quickSend.sendMonth.value}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t.history.title.value}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.history.subtitle.value}
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t.history.table.type.value}</TableCell>
                  <TableCell>{t.history.table.reportDate.value}</TableCell>
                  <TableCell>{t.history.table.chat.value}</TableCell>
                  <TableCell>{t.history.table.status.value}</TableCell>
                  <TableCell>{t.history.table.sentAt.value}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.length === 0 && !loadingReports && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {t.history.empty.value}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {reports.map(report => (
                  <TableRow key={report.id} hover>
                    <TableCell>{getReportTypeLabel(report.reportType)}</TableCell>
                    <TableCell>{formatTelegramDate(report.reportDate)}</TableCell>
                    <TableCell>{report.chatId}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={getStatusColor(report.status)}
                        label={getStatusLabel(report.status)}
                      />
                    </TableCell>
                    <TableCell>{formatTelegramDate(report.sentAt || report.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
    </Stack>
  );
}

function getStatusColor(status: ReportStatus): 'success' | 'error' | 'default' {
  switch (status) {
    case 'sent':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}
