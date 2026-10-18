'use client';

import { Box, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Plus, Trash2 } from '@/app/components/icons';
import { PanelBackTitle } from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { apiBaseUrl } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import { PluginOffBanner } from '../components/PluginOffBanner';
import { type EndpointDefaults, EndpointDefaultsFields } from './EndpointDefaultsFields';
import { useWebhookEndpoints, useWebhookSubscriptions, type WebhookEventName } from './useWebhooks';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';
import { WebhookEventPicker } from './WebhookEventPicker';
import { EVENT_LABEL_KEY, isWebhookEventName } from './webhook-events';
import { inboundWebhookUrls } from './webhook-urls';

interface WebhooksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Set when the drawer is the second layer of the plugins panel. */
  onBack?: () => void;
  zIndex?: number;
}

const tabBtnStyle = (active: boolean) => ({
  padding: '6px 16px',
  borderRadius: tokens.radius.full,
  border: 'none',
  background: active ? 'var(--primary-fill)' : 'transparent',
  color: active ? tokens.color.primaryContrast : 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
});

const ICON_BTN_LAYOUT = { display: 'inline-flex', alignItems: 'center', gap: 4 };

const NO_DEFAULTS: EndpointDefaults = { defaultWalletId: null, defaultBranchId: null };

const actionBtnStyle = (variant: 'danger' | 'default' | 'primary') => ({
  padding: '5px 12px',
  borderRadius: tokens.radius.full,
  border:
    variant === 'danger'
      ? `1px solid ${tokens.color.danger}`
      : variant === 'primary'
        ? 'none'
        : '1px solid var(--border-color)',
  background: variant === 'primary' ? 'var(--primary-fill)' : 'transparent',
  color:
    variant === 'danger'
      ? tokens.color.danger
      : variant === 'primary'
        ? tokens.color.primaryContrast
        : 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
});

export function WebhooksDrawer({ isOpen, onClose, onBack, zIndex }: WebhooksDrawerProps) {
  const t = useIntlayer('webhooksDrawer');
  const pluginsText = useIntlayer('pluginsPage');
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');

  const {
    endpoints,
    loading: endpointsLoading,
    newToken,
    setNewToken,
    create: createEndpoint,
    remove: removeEndpoint,
    toggle: toggleEndpoint,
  } = useWebhookEndpoints();

  const {
    subscriptions,
    loading: subsLoading,
    create: createSubscription,
    remove: removeSubscription,
    testPing,
  } = useWebhookSubscriptions();

  // Inbound form state
  const [showEndpointForm, setShowEndpointForm] = useState(false);
  const [endpointName, setEndpointName] = useState('');
  const [endpointDefaults, setEndpointDefaults] = useState<EndpointDefaults>(NO_DEFAULTS);
  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null);
  const newTokenUrls = useMemo(
    () =>
      newToken && typeof window !== 'undefined'
        ? inboundWebhookUrls(apiBaseUrl, window.location.origin, newToken)
        : null,
    [newToken],
  );

  // Outbound form state
  const [showSubForm, setShowSubForm] = useState(false);
  const [subName, setSubName] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subSecret, setSubSecret] = useState('');
  const [subEvents, setSubEvents] = useState<WebhookEventName[]>([]);

  const handleCreateEndpoint = async () => {
    if (!endpointName.trim()) return;
    await createEndpoint({ name: endpointName.trim(), ...endpointDefaults });
    setEndpointName('');
    setEndpointDefaults(NO_DEFAULTS);
    setShowEndpointForm(false);
  };

  const handleCreateSubscription = async () => {
    if (!(subName.trim() && subUrl.trim()) || subSecret.length < 16 || subEvents.length === 0)
      return;
    await createSubscription({
      name: subName.trim(),
      url: subUrl.trim(),
      secret: subSecret,
      events: subEvents,
    });
    setSubName('');
    setSubUrl('');
    setSubSecret('');
    setSubEvents([]);
    setShowSubForm(false);
  };

  const handleCopyToken = (token: string) => {
    void navigator.clipboard.writeText(token).then(() => toast.success(t.toasts.tokenCopied.value));
  };

  const eventLabel = (event: string) =>
    isWebhookEventName(event) ? t.events[EVENT_LABEL_KEY[event]].value : event;

  const toggleEvent = (value: WebhookEventName) => {
    setSubEvents(prev => (prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]));
  };

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={onBack ? <PanelBackTitle title={t.title} onBack={onBack} /> : t.title}
      position="right"
      width="lg"
      zIndex={zIndex}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <PluginOffBanner plugin="webhooks" message={pluginsText.offBanner.webhooks} />
        {/* Tab switcher */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            p: 0.5,
            borderRadius: tokens.radius.md,
            border: '1px solid var(--border-color)',
            alignSelf: 'flex-start',
          }}
        >
          <button
            type="button"
            style={tabBtnStyle(activeTab === 'inbound')}
            onClick={() => setActiveTab('inbound')}
          >
            {t.inbound}
          </button>
          <button
            type="button"
            style={tabBtnStyle(activeTab === 'outbound')}
            onClick={() => setActiveTab('outbound')}
          >
            {t.outbound}
          </button>
        </Box>

        {/* Inbound tab */}
        {activeTab === 'inbound' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'auto' }}>
            <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t.inboundHint}
            </Typography>

            {/* New token banner */}
            {newToken && (
              <Box
                sx={theme => ({
                  p: 2,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.4)}`,
                  background: alpha(theme.palette.success.main, 0.06),
                })}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'success.main', mb: 1 }}>
                  {t.tokenOnce}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                      flex: 1,
                    }}
                  >
                    {newToken}
                  </Typography>
                  <button
                    type="button"
                    style={actionBtnStyle('primary')}
                    onClick={() => handleCopyToken(newToken)}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    style={actionBtnStyle('default')}
                    onClick={() => setNewToken(null)}
                  >
                    {t.dismiss}
                  </button>
                </Box>
                {newTokenUrls ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                    {(
                      [
                        [t.statementsUrl, newTokenUrls.statements],
                        [t.receiptsUrl, newTokenUrls.receipts],
                      ] as const
                    ).map(([label, url]) => (
                      <Box key={url}>
                        <Typography
                          sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}
                        >
                          {label}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: 'var(--text-primary)',
                              wordBreak: 'break-all',
                              flex: 1,
                            }}
                          >
                            {url}
                          </Typography>
                          <button
                            type="button"
                            style={actionBtnStyle('default')}
                            aria-label={label.value}
                            onClick={() => handleCopyToken(url)}
                          >
                            <Copy size={14} />
                          </button>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </Box>
            )}

            {/* Endpoint list */}
            {endpointsLoading ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t.loading}
              </Typography>
            ) : endpoints.length === 0 && !showEndpointForm ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t.noEndpoints}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {endpoints.map(ep => (
                  <Box
                    key={ep.id}
                    sx={{
                      p: 1.5,
                      borderRadius: tokens.radius.md,
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
                      >
                        {ep.name}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {ep.tokenPreview}
                      </Typography>
                    </Box>
                    <Box
                      sx={theme => ({
                        px: 1,
                        py: 0.25,
                        borderRadius: tokens.radius.full,
                        background: ep.isActive
                          ? alpha(theme.palette.success.main, 0.1)
                          : theme.palette.action.hover,
                        color: ep.isActive ? 'success.main' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      })}
                      onClick={() => void toggleEndpoint(ep.id, ep.isActive)}
                    >
                      {ep.isActive ? t.active : t.paused}
                    </Box>
                    <button
                      type="button"
                      style={actionBtnStyle('danger')}
                      onClick={() => void removeEndpoint(ep.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </Box>
                ))}
              </Box>
            )}

            {/* Inline create form */}
            {showEndpointForm ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border-color)',
                }}
              >
                <TextField
                  size="small"
                  label={t.endpointName}
                  value={endpointName}
                  onChange={e => setEndpointName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreateEndpoint();
                  }}
                  autoFocus
                />
                <EndpointDefaultsFields value={endpointDefaults} onChange={setEndpointDefaults} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <button
                    type="button"
                    style={{ ...actionBtnStyle('primary'), ...ICON_BTN_LAYOUT }}
                    onClick={() => void handleCreateEndpoint()}
                  >
                    <Plus size={14} aria-hidden />
                    {t.create}
                  </button>
                  <button
                    type="button"
                    style={actionBtnStyle('default')}
                    onClick={() => {
                      setShowEndpointForm(false);
                      setEndpointName('');
                      setEndpointDefaults(NO_DEFAULTS);
                    }}
                  >
                    {t.cancel}
                  </button>
                </Box>
              </Box>
            ) : (
              <button
                type="button"
                style={{
                  ...actionBtnStyle('default'),
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setShowEndpointForm(true)}
              >
                {t.newEndpoint}
              </button>
            )}
          </Box>
        )}

        {/* Outbound tab */}
        {activeTab === 'outbound' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'auto' }}>
            <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t.outboundHint}
            </Typography>

            {/* Subscription list */}
            {subsLoading ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t.loading}
              </Typography>
            ) : subscriptions.length === 0 && !showSubForm ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t.noSubscriptions}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {subscriptions.map(sub => (
                  <Box
                    key={sub.id}
                    sx={{
                      p: 1.5,
                      borderRadius: tokens.radius.md,
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {sub.name}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sub.url}
                        </Typography>
                      </Box>
                      <button
                        type="button"
                        style={actionBtnStyle('default')}
                        onClick={() => void testPing(sub.id)}
                      >
                        {t.test}
                      </button>
                      <button
                        type="button"
                        style={actionBtnStyle('danger')}
                        onClick={() => void removeSubscription(sub.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {sub.events.map(evt => (
                        <Box
                          key={evt}
                          sx={theme => ({
                            px: 1,
                            py: 0.25,
                            borderRadius: tokens.radius.full,
                            background: alpha(theme.palette.primary.main, 0.08),
                            color: 'primary.main',
                            fontSize: 11,
                            fontWeight: 600,
                          })}
                        >
                          {eventLabel(evt)}
                        </Box>
                      ))}
                    </Box>
                    <Box>
                      <button
                        type="button"
                        style={actionBtnStyle('default')}
                        aria-expanded={openDeliveries === sub.id}
                        onClick={() => setOpenDeliveries(open => (open === sub.id ? null : sub.id))}
                      >
                        {t.deliveries}
                      </button>
                    </Box>
                    {openDeliveries === sub.id ? (
                      <WebhookDeliveryLog subscriptionId={sub.id} />
                    ) : null}
                  </Box>
                ))}
              </Box>
            )}

            {/* Inline create form */}
            {showSubForm ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border-color)',
                }}
              >
                <TextField
                  size="small"
                  label={t.name}
                  value={subName}
                  onChange={e => setSubName(e.target.value)}
                />
                <TextField
                  size="small"
                  label="URL"
                  value={subUrl}
                  onChange={e => setSubUrl(e.target.value)}
                  placeholder="https://example.com/hook"
                />
                <TextField
                  size="small"
                  label={t.secret}
                  value={subSecret}
                  onChange={e => setSubSecret(e.target.value)}
                  error={subSecret.length > 0 && subSecret.length < 16}
                  helperText={subSecret.length > 0 && subSecret.length < 16 ? t.secretTooShort : ''}
                />
                <Box>
                  <Typography
                    sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', mb: 0.5 }}
                  >
                    {t.eventsLabel}
                  </Typography>
                  <WebhookEventPicker selected={subEvents} onToggle={toggleEvent} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <button
                    type="button"
                    style={{ ...actionBtnStyle('primary'), ...ICON_BTN_LAYOUT }}
                    onClick={() => void handleCreateSubscription()}
                    disabled={
                      !(subName.trim() && subUrl.trim()) ||
                      subSecret.length < 16 ||
                      subEvents.length === 0
                    }
                  >
                    <Plus size={14} aria-hidden />
                    {t.create}
                  </button>
                  <button
                    type="button"
                    style={actionBtnStyle('default')}
                    onClick={() => {
                      setShowSubForm(false);
                      setSubName('');
                      setSubUrl('');
                      setSubSecret('');
                      setSubEvents([]);
                    }}
                  >
                    {t.cancel}
                  </button>
                </Box>
              </Box>
            ) : (
              <button
                type="button"
                style={{
                  ...actionBtnStyle('default'),
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setShowSubForm(true)}
              >
                {t.newSubscription}
              </button>
            )}
          </Box>
        )}
      </Box>
    </DrawerShell>
  );
}
