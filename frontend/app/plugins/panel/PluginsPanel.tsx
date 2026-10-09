'use client';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import WebhookIcon from '@mui/icons-material/Webhook';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
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
  onToggle,
  onOpen,
}: {
  plugin: PluginRowItem;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  const t = useIntlayer('pluginsPage');

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
        disabled={!plugin.configurable}
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
          cursor: plugin.configurable ? 'pointer' : 'default',
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
        {plugin.configurable ? (
          <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
        ) : null}
      </Box>
      <Switch
        checked={active}
        onChange={onToggle}
        size="small"
        inputProps={{ 'aria-label': t.toggle.value.replace('{name}', plugin.name) }}
        sx={{ mr: 0.5 }}
      />
    </Box>
  );
}

export function PluginsPanel(): React.JSX.Element {
  const { panel, item } = useAppPanelState();
  const open = panel === 'plugins';
  const plugins = usePlugins();
  const { isEnabled, toggle } = usePluginState();
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
                onToggle={() => toggle(plugin.key)}
                onOpen={() => openAppPanelItem(plugin.key)}
              />
            ))}
          </Box>
        </Box>
      </DrawerShell>

      <AiAssistantDrawer
        isOpen={open && item === 'ai-assistant'}
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
