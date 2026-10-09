'use client';

import { Box, Button, Chip, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalModel } from '@/app/(main)/ai-analysis/llm/useLocalModel';
import { RECOMMENDED_MODEL_ID, resolveCatalog } from '@/app/(main)/ai-analysis/model-catalog';
import { useIntlayer } from '@/app/i18n';
import { isExperimentalModeEnabled } from '@/app/lib/experimental-mode';
import { tokens } from '@/lib/theme-tokens';
import {
  type CloudProviderStatus,
  createCloudAgentEngine,
  fetchCloudProviderStatus,
} from './agent/cloud-engine';
import { useAgentChat } from './agent/useAgentChat';
import { createWebLlmAgentEngine } from './agent/webllm-engine';
import {
  type ChatEngineChoice,
  getChatEnginePreference,
  setChatEnginePreference,
} from './chat-engine-preference';
import { setChatModePreferred } from './chat-mode-preference';
import { ActionCard } from './components/ActionCard';

export default function ChatModePage(): React.JSX.Element {
  const t = useIntlayer('chatMode');
  const router = useRouter();
  const { load, engine, ...modelState } = useLocalModel();

  // Cloud-first: a configured BYO-key provider serves the chat without any
  // local download; the local WebGPU model remains the fallback.
  const [cloud, setCloud] = useState<CloudProviderStatus | null>(null);
  useEffect(() => {
    fetchCloudProviderStatus()
      .then(setCloud)
      .catch(() => setCloud({ configured: false, model: null, source: 'disabled' }));
  }, []);

  // Read on the client only: the stored choice must not diverge from the
  // server-rendered markup.
  const [enginePreference, setEnginePreference] = useState<ChatEngineChoice | null>(null);
  useEffect(() => {
    setEnginePreference(getChatEnginePreference());
  }, []);

  /** Tokens the cloud provider billed for this chat, tool rounds included. */
  const [tokensUsed, setTokensUsed] = useState(0);

  const activeModel = resolveCatalog().find(entry => entry.modelId === modelState.activeModelId);
  const localReady = modelState.status === 'ready' && engine !== null && activeModel !== undefined;
  const cloudReady = cloud?.configured === true;
  const useCloud = cloudReady && enginePreference !== 'local';
  const ready = useCloud || localReady;

  const agentEngine = useMemo(() => {
    if (useCloud) {
      return createCloudAgentEngine(usage =>
        setTokensUsed(
          previous => previous + (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
        ),
      );
    }
    return engine ? createWebLlmAgentEngine(engine) : null;
  }, [useCloud, engine]);
  const { turns, busy, send, stop, confirmAction, cancelAction, startNew } = useAgentChat(
    agentEngine,
    useCloud ? (cloud?.model ?? 'cloud') : (activeModel?.modelId ?? RECOMMENDED_MODEL_ID),
  );

  const chooseEngine = (choice: ChatEngineChoice): void => {
    setEnginePreference(choice);
    setChatEnginePreference(choice);
  };

  const startNewChat = (): void => {
    setTokensUsed(0);
    startNew();
  };

  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns]);

  // Chat mode is unfinished: it is reachable only while experimental mode is on.
  // Entering the page opts the device into chat mode; the exit button opts out.
  useEffect(() => {
    if (!isExperimentalModeEnabled()) {
      setChatModePreferred(false);
      router.replace('/dashboard');
      return;
    }
    setChatModePreferred(true);
  }, [router]);

  const exitMode = (): void => {
    setChatModePreferred(false);
    router.push('/dashboard');
  };

  const submit = (text?: string): void => {
    const question = (text ?? draft).trim();
    if (question === '' || busy || !ready) {
      return;
    }
    setDraft('');
    void send(question);
  };

  return (
    <Box
      sx={{
        maxWidth: 720,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Button size="small" variant="text" onClick={startNewChat} disabled={busy}>
          {t.newChat}
        </Button>
        <Button size="small" variant="outlined" onClick={exitMode}>
          {t.exitMode}
        </Button>
      </Stack>

      {cloudReady ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1.5 }}
        >
          <Chip
            size="small"
            label={t.engineCloud}
            variant={useCloud ? 'filled' : 'outlined'}
            color={useCloud ? 'primary' : 'default'}
            onClick={() => chooseEngine('cloud')}
            disabled={busy}
          />
          <Chip
            size="small"
            label={t.engineLocal}
            variant={useCloud ? 'outlined' : 'filled'}
            color={useCloud ? 'default' : 'primary'}
            onClick={() => chooseEngine('local')}
            disabled={busy}
          />
          {useCloud ? (
            <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {cloud?.model} · {cloud?.source === 'personal' ? t.keyPersonal : t.keyWorkspace}
            </Typography>
          ) : null}
          {tokensUsed > 0 ? (
            <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              ≈ {tokensUsed} {t.tokensLabel}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {!ready ? (
        <Stack spacing={2} sx={{ my: 'auto', alignItems: 'flex-start' }}>
          <Typography sx={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {t.modelNeeded}
          </Typography>
          {modelState.status === 'downloading' ? (
            <Box sx={{ width: '100%' }}>
              <LinearProgress
                variant={modelState.progress === null ? 'indeterminate' : 'determinate'}
                value={(modelState.progress ?? 0) * 100}
              />
              {modelState.progressText ? (
                <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)', mt: 0.5 }}>
                  {modelState.progressText}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" onClick={() => void load(RECOMMENDED_MODEL_ID)}>
                {t.loadModel}
              </Button>
              <Button variant="outlined" component={Link} href="/ai-analysis">
                {t.manageModels}
              </Button>
              <Button variant="outlined" component={Link} href="/integrations/ai-compatible">
                {t.configureCloud}
              </Button>
            </Stack>
          )}
        </Stack>
      ) : (
        <>
          {useCloud ? (
            <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)', mb: 1 }}>
              {t.cloudNotice}
            </Typography>
          ) : null}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
            {turns.length === 0 ? (
              <Stack spacing={2} sx={{ mt: 4 }}>
                <Typography sx={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {t.welcome}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={t.chipExpense} onClick={() => submit(String(t.chipExpense))} />
                  <Chip label={t.chipUpload} onClick={() => submit(String(t.chipUpload))} />
                  <Chip label={t.chipSpend} onClick={() => submit(String(t.chipSpend))} />
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {turns.map(turn =>
                  turn.role === 'tool' && turn.action ? (
                    <ActionCard
                      key={turn.id}
                      action={turn.action}
                      reply={turn.content}
                      onConfirm={() => void confirmAction(turn.id)}
                      onCancel={() => cancelAction(turn.id)}
                    />
                  ) : (
                    <Box
                      key={turn.id}
                      sx={{
                        alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        bgcolor: turn.role === 'user' ? 'var(--muted)' : 'transparent',
                        border: turn.role === 'user' ? 'none' : '1px solid var(--border-color)',
                        borderRadius: tokens.radius.lg,
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>
                        {turn.content}
                      </Typography>
                    </Box>
                  ),
                )}
                {busy ? (
                  <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>…</Typography>
                ) : null}
              </Stack>
            )}
            <div ref={endRef} />
          </Box>

          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={4}
              value={draft}
              placeholder={String(t.placeholder)}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {busy ? (
              <Button variant="outlined" onClick={stop}>
                {t.stop}
              </Button>
            ) : (
              <Button variant="contained" onClick={() => submit()} disabled={draft.trim() === ''}>
                {t.send}
              </Button>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}
