'use client';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Lock, Trash2 } from '@/app/components/icons';
import { PanelBackTitle } from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import type { ApiKeyScope } from '@/app/lib/contracts';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { useApiKeys } from './useApiKeys';

interface McpServerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Set when the drawer is the second layer of the plugins panel. */
  onBack?: () => void;
  zIndex?: number;
}

const sectionLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  mb: 1.5,
};

const codeBlockStyle = {
  background: 'var(--muted, #f4f4f5)',
  borderRadius: tokens.radius.sm,
  p: 1.5,
  fontFamily: 'monospace',
  fontSize: 12,
  color: 'var(--text-primary)',
  overflowX: 'auto' as const,
  whiteSpace: 'pre' as const,
  position: 'relative' as const,
};

type McpServerText = ReturnType<typeof useIntlayer<'mcpServerDrawer'>>;

function CopyButton({ text }: { text: string }) {
  const t = useIntlayer('mcpServerDrawer');
  const handle = () => {
    void navigator.clipboard.writeText(text).then(() => toast.success(t.copied.value));
  };
  return (
    <button
      type="button"
      onClick={handle}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
      }}
      title={t.copy.value}
    >
      <Copy size={14} />
    </button>
  );
}

const MCP_JSON = `{
  "mcpServers": {
    "lumio": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "LUMIO_BASE_URL": "http://localhost:3001/api/v1",
        "LUMIO_API_KEY": "lum_<your-api-key>",
        "LUMIO_WORKSPACE_ID": "<workspace-uuid>"
      }
    }
  }
}`;

function timeAgo(dateStr: string | null, t: McpServerText): string {
  if (!dateStr) return t.neverUsed.value;
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return t.today.value;
  if (d === 1) return t.oneDayAgo.value;
  if (d < 30) return t.daysAgo.value.replace('{count}', String(d));
  return formatStoredDate(dateStr);
}

export function McpServerDrawer({ isOpen, onClose, onBack, zIndex }: McpServerDrawerProps) {
  const t = useIntlayer('mcpServerDrawer');
  const { keys, loading, newKey, isActive, scopes, create, revoke, clearNewKey } = useApiKeys();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [keyName, setKeyName] = useState('');
  // Read-only is the safe default; a wider key is a deliberate choice.
  const [scopeMode, setScopeMode] = useState<'read' | 'write' | 'custom'>('read');
  const [customScopes, setCustomScopes] = useState<ApiKeyScope[]>([]);
  const selectedScopes = scopeMode === 'custom' ? customScopes : (scopes?.presets[scopeMode] ?? []);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!keyName.trim() || selectedScopes.length === 0) return;
    await create(keyName.trim(), selectedScopes);
    setKeyName('');
    setScopeMode('read');
    setCustomScopes([]);
    setShowCreateForm(false);
  };

  const handleRevoke = async () => {
    if (!confirmRevokeId) return;
    await revoke(confirmRevokeId);
    setConfirmRevokeId(null);
  };

  return (
    <>
      <DrawerShell
        isOpen={isOpen}
        onClose={onClose}
        title={onBack ? <PanelBackTitle title={t.title} onBack={onBack} /> : t.title}
        width="md"
        zIndex={zIndex}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1 }}>
          {/* ── Status ── */}
          <Box>
            <Typography sx={sectionLabelStyle}>{t.status}</Typography>
            <Box
              sx={theme => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: tokens.radius.md,
                background: alpha(
                  isActive ? theme.palette.success.main : theme.palette.error.main,
                  0.08,
                ),
                border: `1px solid ${alpha(isActive ? theme.palette.success.main : theme.palette.error.main, 0.2)}`,
              })}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: tokens.radius.full,
                  bgcolor: isActive ? 'success.main' : 'error.main',
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isActive ? 'success.main' : 'error.main',
                }}
              >
                {isActive
                  ? t.connectedKeys.value.replace('{count}', String(keys.length))
                  : t.notConfigured}
              </Typography>
            </Box>
          </Box>

          {/* ── Setup ── */}
          <Box>
            <Typography sx={sectionLabelStyle}>{t.setup}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t.step1}
              </Typography>
              <Box sx={codeBlockStyle}>
                cd mcp-server && npm install && npm run build
                <CopyButton text="cd mcp-server && npm install && npm run build" />
              </Box>

              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t.step2Prefix}{' '}
                <code
                  style={{
                    background: 'var(--muted)',
                    borderRadius: tokens.radius.xs,
                    padding: '1px 4px',
                  }}
                >
                  .mcp.json
                </code>{' '}
                {t.step2Suffix}
              </Typography>
              <Box sx={codeBlockStyle}>
                {MCP_JSON}
                <CopyButton text={MCP_JSON} />
              </Box>

              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t.step3}
              </Typography>
            </Box>
          </Box>

          {/* ── API Keys ── */}
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1.5,
              }}
            >
              <Typography sx={sectionLabelStyle}>{t.apiKeys}</Typography>
              {!showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: tokens.radius.full,
                    border: 'none',
                    background: 'var(--primary-fill)',
                    color: tokens.color.primaryContrast,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.createKey}
                </button>
              )}
            </Box>

            {/* Create form */}
            {showCreateForm && (
              <Box sx={{ display: 'grid', gap: 1, mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  {t.scopeLabel} · {t.scopeHint}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="radiogroup">
                  {(['read', 'write', 'custom'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={scopeMode === mode}
                      onClick={() => setScopeMode(mode)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: tokens.radius.full,
                        border: '1px solid var(--border-color, #e5e7eb)',
                        background: scopeMode === mode ? 'var(--primary-fill)' : 'transparent',
                        color:
                          scopeMode === mode
                            ? tokens.color.primaryContrast
                            : 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {mode === 'read'
                        ? t.scopeRead
                        : mode === 'write'
                          ? t.scopeWrite
                          : t.scopeCustom}
                    </button>
                  ))}
                </Box>
                {scopeMode === 'custom' && scopes && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {scopes.all.map(scope => {
                      const on = customScopes.includes(scope);
                      return (
                        <button
                          key={scope}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() =>
                            setCustomScopes(current =>
                              on ? current.filter(item => item !== scope) : [...current, scope],
                            )
                          }
                          style={{
                            padding: '2px 8px',
                            borderRadius: tokens.radius.full,
                            border: '1px solid var(--border-color, #e5e7eb)',
                            background: on ? 'var(--primary-fill)' : 'transparent',
                            color: on ? tokens.color.primaryContrast : 'var(--text-secondary)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {scope}
                        </button>
                      );
                    })}
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder={t.keyNamePlaceholder.value}
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleCreate();
                    }}
                    autoFocus
                    fullWidth
                    sx={{ fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={!keyName.trim() || selectedScopes.length === 0}
                    style={{
                      padding: '6px 14px',
                      borderRadius: tokens.radius.full,
                      border: 'none',
                      background: 'var(--primary-fill)',
                      color: tokens.color.primaryContrast,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: keyName.trim() ? 'pointer' : 'not-allowed',
                      opacity: keyName.trim() ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.create}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setKeyName('');
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: tokens.radius.full,
                      border: '1px solid var(--border-color, #e5e7eb)',
                      background: 'transparent',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t.cancel}
                  </button>
                </Box>
              </Box>
            )}

            {/* Keys list */}
            {loading ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t.loading}
              </Typography>
            ) : keys.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, color: 'var(--text-secondary)' }}>
                <Lock size={24} style={{ opacity: 0.3, marginBottom: 6 }} />
                <Typography sx={{ fontSize: 13 }}>{t.noKeys}</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {keys.map(key => (
                  <Box
                    key={key.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: tokens.radius.md,
                      border: '1px solid var(--border-color, #e5e7eb)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{key.name}</Typography>
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        lum_{key.prefix}•••• · {timeAgo(key.lastUsedAt, t)} ·{' '}
                        {key.scopes
                          ? t.scopeCount.value.replace('{count}', String(key.scopes.length))
                          : t.scopeLegacy.value}
                      </Typography>
                    </Box>
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(key.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title={t.revokeKey.value}
                    >
                      <Trash2 size={15} />
                    </button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </DrawerShell>

      {/* New key dialog — shown only once */}
      <Dialog open={Boolean(newKey)} onClose={clearNewKey} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t.saveKeyTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', mb: 2 }}>
            {t.saveKeyHint}
          </Typography>
          <Box sx={{ ...codeBlockStyle, wordBreak: 'break-all', whiteSpace: 'normal' }}>
            {newKey?.key}
            <CopyButton text={newKey?.key ?? ''} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              void navigator.clipboard.writeText(newKey?.key ?? '').then(() => {
                toast.success(t.copiedToClipboard.value);
                clearNewKey();
              });
            }}
          >
            {t.copyAndClose}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog
        open={Boolean(confirmRevokeId)}
        onClose={() => setConfirmRevokeId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t.revokeTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {t.revokeHint}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmRevokeId(null)} sx={{ color: 'var(--text-secondary)' }}>
            {t.cancel}
          </Button>
          <Button variant="contained" color="error" onClick={() => void handleRevoke()}>
            {t.revoke}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
