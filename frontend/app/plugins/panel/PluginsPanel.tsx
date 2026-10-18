'use client';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import WebhookIcon from '@mui/icons-material/Webhook';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { ChevronRight, Cpu } from '@/app/components/icons';
import {
  closeAppPanel,
  closeAppPanelItem,
  openAppPanelItem,
  useAppPanelState,
} from '@/app/components/panels/app-panels-store';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { AiAssistantDrawer } from '../ai-assistant/AiAssistantDrawer';
import { usePluginState } from '../hooks/usePluginState';
import { McpServerDrawer } from '../mcp-server/McpServerDrawer';
import type { PluginKey } from '../types';
import { WebhooksDrawer } from '../webhooks/WebhooksDrawer';

type PluginRowItem = {
  key: PluginKey;
  name: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  /** Whether the plugin has settings of its own in the second layer. */
  configurable: boolean;
};

function usePlugins(): PluginRowItem[] {
  const t = useIntlayer('pluginsPage');
  const webhooksText = useIntlayer('webhooksDrawer');
  const mcpText = useIntlayer('mcpServerDrawer');

  return [
    {
      key: 'ai-assistant',
      name: t.cards.aiAssistant.name.value,
      description: t.cards.aiAssistant.description,
      icon: <SmartToyIcon sx={{ fontSize: 22 }} />,
      configurable: true,
    },
    {
      key: 'webhooks',
      name: webhooksText.title.value,
      description: t.cards.webhooks.description,
      icon: <WebhookIcon sx={{ fontSize: 22 }} />,
      configurable: true,
    },
    {
      key: 'mcp-server',
      name: mcpText.title.value,
      description: t.cards.mcpServer.description,
      icon: <Cpu size={22} />,
      configurable: true,
    },
  ];
}

function PluginRow({
  plugin,
  active,
  canToggle,
  pending,
  onToggle,
  onOpen,
}: {
  plugin: PluginRowItem;
  active: boolean;
  canToggle: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
}): React.JSX.Element {
  const t = useIntlayer('pluginsPage');
  // The assistant has nothing to configure while off; the others open to set up first.
  const openable = plugin.configurable && (active || plugin.key !== 'ai-assistant');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: tokens.radius.md,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        disabled={!openable}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          gap: 1.5,
          px: 1,
          py: 1.25,
          border: 'none',
          bgcolor: 'transparent',
          textAlign: 'left',
          color: 'text.primary',
          cursor: openable ? 'pointer' : 'default',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: tokens.radius.sm,
            bgcolor: 'action.hover',
            color: active ? 'primary.main' : 'text.secondary',
          }}
        >
          {plugin.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{plugin.name}</Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {plugin.description}
          </Typography>
        </Box>
        {openable ? <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} /> : null}
      </Box>
      <Tooltip title={canToggle ? '' : t.adminOnlyToggle.value}>
        <span>
          <Switch
            checked={active}
            onChange={(_event, checked) => onToggle(checked)}
            disabled={!canToggle || pending}
            size="small"
            slotProps={{ input: { 'aria-label': t.toggle.value.replace('{name}', plugin.name) } }}
            sx={{ mr: 0.5 }}
          />
        </span>
      </Tooltip>
    </Box>
  );
}

export function PluginsPanel(): React.JSX.Element {
  const { panel, item } = useAppPanelState();
  const open = panel === 'plugins';
  const plugins = usePlugins();
  const { isEnabled, setEnabled, canToggle, pending } = usePluginState();
  const t = useIntlayer('pluginsPage');

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={closeAppPanel}
        position="right"
        width="md"
        title={t.title}
        zIndex={1300}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.subtitle}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {plugins.map(plugin => (
              <PluginRow
                key={plugin.key}
                plugin={plugin}
                active={isEnabled(plugin.key)}
                canToggle={canToggle}
                pending={pending === plugin.key}
                onToggle={enabled => void setEnabled(plugin.key, enabled)}
                onOpen={() => openAppPanelItem(plugin.key)}
              />
            ))}
          </Box>
        </Box>
      </DrawerShell>

      <AiAssistantDrawer
        isOpen={open && item === 'ai-assistant' && isEnabled('ai-assistant')}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
      <WebhooksDrawer
        isOpen={open && item === 'webhooks'}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
      <McpServerDrawer
        isOpen={open && item === 'mcp-server'}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
    </>
  );
}
