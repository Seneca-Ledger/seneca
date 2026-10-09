'use client';

import Box from '@mui/material/Box';
import Link from 'next/link';
import {
  Bug,
  Cloud,
  Globe,
  PlayCircle,
  ScrollText,
  Shield,
  Sparkles,
  Trash2,
  UserCircle,
} from '@/app/components/icons';
import { useLanguageSelection } from '@/app/components/navigation/hooks/useLanguageSelection';
import { LanguageDrawer } from '@/app/components/navigation/LanguageDrawer';
import { type AppPanelKey, openAppPanel } from '@/app/components/panels/app-panels-store';
import { openWelcomeTutorial } from '@/app/components/welcome-tutorial/welcome-tutorial-store';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer, useLocale } from '@/app/i18n';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';

type Tx = (path: string[], fallback: string) => string;

type ElsewhereLink = {
  key: string;
  /** Plain text, like the rest of this card: the rows are one line each. */
  label: string;
  icon: typeof UserCircle;
  /** A route to open, the panel that slides open over the page, or an action. */
  href?: string;
  panel?: AppPanelKey;
  external?: boolean;
  onClick?: () => void;
  /** Hidden unless the user holds this permission. */
  permission?: string;
};

const KNOWLEDGE_BASE_URL = 'https://symonbaikov.github.io/lumio/';
const BUG_REPORT_URL = 'https://github.com/symonbaikov/lumio/issues/new?template=bug_report.yml';

/**
 * Settings that live outside this page. The account menu in the sidebar is kept
 * short on purpose, so everything it does not carry — the trash, the activity
 * log, the language, the tutorial — is reachable from here.
 */
// eslint-disable-next-line max-lines-per-function
export function SettingsElsewhereLinks({ tx }: { tx: Tx }) {
  const { hasPermission } = usePermissions();
  const { nav, userMenu, languageModal, shell } = useIntlayer('navigation');
  const { locale, availableLocales, setLocale } = useLocale();

  const langProps = useLanguageSelection({
    locale,
    availableLocales,
    setLocale,
    languageModal,
    setMobileMenuOpen: () => {},
  });

  const links: ElsewhereLink[] = [
    {
      href: '/workspaces/overview',
      key: 'workspace',
      label: tx(['navigation', 'links', 'workspace'], 'Workspace'),
      icon: UserCircle,
    },
    {
      panel: 'integrations',
      key: 'integrations',
      label: tx(['navigation', 'links', 'integrations'], 'Integrations'),
      icon: Cloud,
    },
    {
      panel: 'plugins',
      key: 'developer',
      label: tx(['navigation', 'links', 'developer'], 'API keys & webhooks'),
      icon: Shield,
    },
    {
      key: 'language',
      label: `${resolveLabel(userMenu.language, 'Language')} · ${langProps.languageLabel}`,
      icon: Globe,
      onClick: langProps.openLanguageMenu,
    },
    {
      href: '/statements/trash',
      key: 'trash',
      label: resolveLabel(userMenu.trash, 'Trash'),
      icon: Trash2,
    },
    {
      href: '/ai-analysis',
      key: 'aiAnalysis',
      label: resolveLabel(nav.aiAnalysis, 'AI analysis'),
      icon: Sparkles,
    },
    {
      href: '/admin',
      key: 'activityLog',
      label: resolveLabel(nav.activityLog, 'Activity log'),
      icon: ScrollText,
      permission: 'audit_log.view',
    },
    {
      key: 'welcomeTutorial',
      label: resolveLabel(userMenu.welcomeTutorial, 'Welcome tutorial'),
      icon: PlayCircle,
      onClick: openWelcomeTutorial,
    },
    {
      href: KNOWLEDGE_BASE_URL,
      key: 'knowledgeBase',
      label: resolveLabel(userMenu.knowledgeBase, 'Knowledge base'),
      icon: UserCircle,
      external: true,
    },
    {
      href: BUG_REPORT_URL,
      key: 'reportBug',
      label: resolveLabel(shell.reportBug, 'Report a bug'),
      icon: Bug,
      external: true,
    },
  ];

  const visible = links.filter(link => !link.permission || hasPermission(link.permission));

  return (
    <>
      {visible.map(link => (
        <Box
          key={link.key}
          {...(link.panel || link.onClick
            ? {
                component: 'button' as const,
                type: 'button' as const,
                onClick: () => (link.panel ? openAppPanel(link.panel) : link.onClick?.()),
              }
            : link.external
              ? {
                  component: 'a' as const,
                  href: link.href as string,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }
              : { component: Link, href: link.href as string })}
          sx={{
            border: 'none',
            bgcolor: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 1.5,
            borderRadius: tokens.radius.md,
            px: 1.5,
            py: 1.25,
            fontSize: 14,
            fontWeight: 500,
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              height: 32,
              width: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.sm,
              color: 'text.secondary',
            }}
          >
            <link.icon size={18} />
          </Box>
          <span>{link.label}</span>
        </Box>
      ))}

      <LanguageDrawer
        isOpen={langProps.languageModalOpen}
        onClose={langProps.closeLanguageMenu}
        languageModal={languageModal}
        languageSearch={langProps.languageSearch}
        setLanguageSearch={langProps.setLanguageSearch}
        filteredLanguages={langProps.filteredLanguages}
        normalizedLocale={langProps.normalizedLocale}
        handleLanguageSelect={langProps.handleLanguageSelect as (code: string) => void}
      />
    </>
  );
}
