'use client';

import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DollarSign,
  Landmark,
  PiggyBank,
  ShieldAlert,
  TrendingUp,
  Users,
} from '@/app/components/icons';
import { PanelBackTitle } from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { promptTemplates } from './prompt-templates';

const CHATGPT_URL = 'https://chatgpt.com/';
const MAX_URL_LENGTH = 6000;

interface CardDef {
  key: string;
  title: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactElement;
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Set when the drawer sits on top of the plugin catalogue. */
  onBack?: () => void;
  zIndex?: number;
}

export function AiAssistantDrawer({ isOpen, onClose, onBack, zIndex }: AiAssistantDrawerProps) {
  const t = useIntlayer('aiAssistantDrawer');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const cards: CardDef[] = [
    {
      key: 'expense-summary',
      title: t.cards.expenseSummary.title,
      description: t.cards.expenseSummary.description,
      icon: <DollarSign size={20} />,
    },
    {
      key: 'cash-flow',
      title: t.cards.cashFlow.title,
      description: t.cards.cashFlow.description,
      icon: <TrendingUp size={20} />,
    },
    {
      key: 'top-counterparties',
      title: t.cards.topCounterparties.title,
      description: t.cards.topCounterparties.description,
      icon: <Users size={20} />,
    },
    {
      key: 'tax-preparation',
      title: t.cards.taxPreparation.title,
      description: t.cards.taxPreparation.description,
      icon: <Landmark size={20} />,
    },
    {
      key: 'anomaly-detection',
      title: t.cards.anomalyDetection.title,
      description: t.cards.anomalyDetection.description,
      icon: <ShieldAlert size={20} />,
    },
    {
      key: 'budget-recommendations',
      title: t.cards.budgetRecommendations.title,
      description: t.cards.budgetRecommendations.description,
      icon: <PiggyBank size={20} />,
    },
  ];

  const handleCardClick = useCallback(
    async (key: string) => {
      const template = promptTemplates.find(pt => pt.key === key);
      if (!template) return;

      setLoadingKey(key);

      await (async () => {
        const prompt = await template.buildPrompt();
        const encoded = encodeURIComponent(prompt);
        const url = `${CHATGPT_URL}?q=${encoded}`;

        if (url.length > MAX_URL_LENGTH) {
          await navigator.clipboard.writeText(prompt);
          toast.success(t.copied.value);
          window.open(CHATGPT_URL, '_blank', 'noopener,noreferrer');
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      })()
        .catch(async () => {
          toast.error(t.loadFailed.value);
        })
        .finally(async () => {
          setLoadingKey(null);
        });
    },
    [t.copied, t.loadFailed],
  );

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={onBack ? <PanelBackTitle title={t.title} onBack={onBack} /> : t.title}
      position="right"
      width="lg"
      zIndex={zIndex}
    >
      <Box sx={{ px: 2, pb: 2 }}>
        <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', mb: 2.5 }}>
          {t.subtitle}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
          }}
        >
          {cards.map(card => {
            const isLoading = loadingKey === card.key;
            return (
              <Box
                key={card.key}
                onClick={() => {
                  if (!isLoading) void handleCardClick(card.key);
                }}
                sx={{
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: tokens.radius.lg,
                  p: 2,
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  '&:hover': isLoading
                    ? {}
                    : {
                        borderColor: 'primary.main',
                      },
                }}
              >
                <Box
                  sx={theme => ({
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                  })}
                >
                  {card.icon}
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {card.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {card.description}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'primary.main',
                    mt: 'auto',
                    pt: 0.5,
                  }}
                >
                  {isLoading ? t.loading : t.run}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </DrawerShell>
  );
}
