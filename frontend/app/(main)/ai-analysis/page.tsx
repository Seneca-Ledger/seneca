'use client';

import { Box, Button, Tab, Tabs, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { ChatTab } from './components/ChatTab';
import { ModelCatalogTab } from './components/ModelCatalogTab';
import { generateInsight } from './insights/generate-insight';
import { useLocalModel } from './llm/useLocalModel';
import { resolveCatalog } from './model-catalog';

type AiAnalysisTab = 'model' | 'chat';

export default function AiAnalysisPage(): React.JSX.Element {
  const t = useIntlayer('aiAnalysisPage');
  const [tab, setTab] = useState<AiAnalysisTab>('model');
  // Held here, not inside the Model tab: switching tabs must not tear down a
  // download in flight, and the Chat tab needs to know whether a model is ready.
  const { load, cancel, unload, engine, ...modelState } = useLocalModel();

  const activeModel = resolveCatalog().find(entry => entry.modelId === modelState.activeModelId);
  const chatReady = modelState.status === 'ready' && engine !== null && activeModel !== undefined;
  const [insightState, setInsightState] = useState<'idle' | 'working' | 'saved' | 'failed'>('idle');

  const writeInsight = (): void => {
    if (!(engine && activeModel)) {
      return;
    }
    setInsightState('working');
    generateInsight(engine, activeModel.modelId, activeModel.contextTokens, new Date())
      .then(() => setInsightState('saved'))
      .catch(() => setInsightState('failed'));
  };

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--lumio-page-top, 40px)', pb: 5 }}
    >
      <Tabs
        value={tab}
        onChange={(_event, next: AiAnalysisTab) => setTab(next)}
        sx={{ borderBottom: '1px solid var(--border-color)', mb: 3 }}
      >
        <Tab value="model" label={t.tabs.model} />
        <Tab value="chat" label={t.tabs.chat} />
      </Tabs>

      {tab === 'model' ? (
        <ModelCatalogTab
          model={modelState}
          onInstall={modelId => void load(modelId)}
          onCancel={cancel}
          onRemove={() => void unload()}
        />
      ) : chatReady ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={writeInsight}
              disabled={insightState === 'working'}
            >
              {t.insightAction}
            </Button>
            {insightState === 'saved' ? (
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {t.insightSaved}
              </Typography>
            ) : null}
            {insightState === 'failed' ? (
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {t.insightFailed}
              </Typography>
            ) : null}
          </Box>
          <ChatTab
            engine={engine}
            modelContextTokens={activeModel.contextTokens}
            modelId={activeModel.modelId}
          />
        </Box>
      ) : (
        <Typography sx={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {t.chatLocked}
        </Typography>
      )}
    </Box>
  );
}
