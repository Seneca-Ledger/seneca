'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PromptMessage } from '@/app/(main)/ai-analysis/chat/build-prompt';
import * as chatsApi from '@/app/(main)/ai-analysis/chat/chats-api';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { currencyOr } from '@/app/lib/currency';
import { parseIntent } from '../tools/registry';
import type { ChatTool } from '../tools/types';
import {
  buildAgentSystemPrompt,
  buildRetryMessage,
  buildToolResultMessage,
} from './build-agent-prompt';

/**
 * The narrow slice of the WebLLM engine the agent loop needs. Kept minimal so
 * tests can script conversations without a GPU.
 */
export interface AgentEngine {
  complete(messages: PromptMessage[]): Promise<string>;
  interrupt?(): void;
}

export type AgentActionStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface AgentAction {
  toolName: string;
  kind: ChatTool['kind'];
  summary: string;
  params: unknown;
  status: AgentActionStatus;
  result?: unknown;
  errorMessage?: string;
}

export interface AgentTurn {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  streaming?: boolean;
  action?: AgentAction;
}

/** How many automatic tool rounds one user message may trigger. */
const MAX_READ_ROUNDS = 2;

let turnCounter = 0;
function nextId(): string {
  turnCounter += 1;
  return `agent-turn-${turnCounter}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toHistory(turns: AgentTurn[]): PromptMessage[] {
  return turns
    .filter(turn => turn.role !== 'tool' && turn.content !== '')
    .map(turn => ({ role: turn.role as 'user' | 'assistant', content: turn.content }));
}

export function useAgentChat(engine: AgentEngine | null, modelId: string) {
  const { currentWorkspace } = useWorkspace();
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const abortRef = useRef(false);
  /** Pending write actions by turn id, kept out of state to avoid stale closures. */
  const pendingRef = useRef<Map<string, { tool: ChatTool; params: unknown }>>(new Map());

  const stop = useCallback(() => {
    abortRef.current = true;
    engine?.interrupt?.();
  }, [engine]);

  const patchTurn = useCallback((id: string, patch: Partial<AgentTurn>) => {
    setTurns(previous => previous.map(turn => (turn.id === id ? { ...turn, ...patch } : turn)));
  }, []);

  const patchAction = useCallback((id: string, patch: Partial<AgentAction>) => {
    setTurns(previous =>
      previous.map(turn =>
        turn.id === id && turn.action ? { ...turn, action: { ...turn.action, ...patch } } : turn,
      ),
    );
  }, []);

  /**
   * Best-effort persistence, mirroring the analysis chat: a failure to save
   * must never take the conversation off the screen.
   */
  const persist = useCallback(
    async (
      firstQuestion: string,
      messages: Array<{
        role: 'user' | 'assistant' | 'tool';
        content: string;
        actionPayload?: Record<string, unknown>;
      }>,
    ): Promise<void> => {
      await (async () => {
        let targetId = chatId;
        if (targetId === null) {
          const created = await chatsApi.createChat(modelId, firstQuestion);
          targetId = created.id;
          setChatId(created.id);
        }
        for (const message of messages) {
          await chatsApi.appendMessage(
            targetId,
            message.role,
            message.content,
            message.actionPayload,
          );
        }
        setUnsaved(false);
      })().catch(async () => {
        setUnsaved(true);
      });
    },
    [chatId, modelId],
  );

  // `send` only needs the turns at call time; reading them through a ref keeps
  // its identity stable while a reply streams in (turns change per token).
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const send = useCallback(
    async (question: string): Promise<void> => {
      if (!engine || busy || question.trim() === '') {
        return;
      }

      abortRef.current = false;
      setBusy(true);
      setError(null);

      const system: PromptMessage = {
        role: 'system',
        content: buildAgentSystemPrompt(todayIso(), currencyOr(currentWorkspace?.currency)),
      };
      const history = toHistory(turnsRef.current);
      const userTurn: AgentTurn = { id: nextId(), role: 'user', content: question };
      setTurns(previous => [...previous, userTurn]);

      const toSave: Array<{
        role: 'user' | 'assistant' | 'tool';
        content: string;
        actionPayload?: Record<string, unknown>;
      }> = [{ role: 'user', content: question }];

      return await (async () => {
        const messages: PromptMessage[] = [system, ...history, { role: 'user', content: question }];

        let rounds = 0;
        let retried = false;

        while (!abortRef.current) {
          const raw = await engine.complete(messages);
          const parsed = parseIntent(raw);

          if (!parsed.ok) {
            if (!retried) {
              // One retry with the validation error; then degrade to plain text.
              retried = true;
              messages.push({ role: 'assistant', content: raw }, buildRetryMessage(parsed.error));
              continue;
            }
            const fallback: AgentTurn = { id: nextId(), role: 'assistant', content: raw.trim() };
            setTurns(previous => [...previous, fallback]);
            toSave.push({ role: 'assistant', content: fallback.content });
            break;
          }

          if (!parsed.action) {
            const replyTurn: AgentTurn = { id: nextId(), role: 'assistant', content: parsed.reply };
            setTurns(previous => [...previous, replyTurn]);
            toSave.push({ role: 'assistant', content: parsed.reply });
            break;
          }

          const { tool, params, summary } = parsed.action;

          if (tool.kind === 'write') {
            // Never executed here. The card rendered from this turn calls
            // confirmAction() only on an explicit user tap.
            const cardTurn: AgentTurn = {
              id: nextId(),
              role: 'tool',
              content: parsed.reply,
              action: { toolName: tool.name, kind: tool.kind, summary, params, status: 'pending' },
            };
            pendingRef.current.set(cardTurn.id, { tool, params });
            setTurns(previous => [...previous, cardTurn]);
            toSave.push({
              role: 'tool',
              content: parsed.reply,
              actionPayload: {
                name: tool.name,
                params: params as Record<string, unknown>,
                status: 'pending',
              },
            });
            break;
          }

          // read / ui tools run automatically.
          rounds += 1;
          const cardTurn: AgentTurn = {
            id: nextId(),
            role: 'tool',
            content: parsed.reply,
            action: { toolName: tool.name, kind: tool.kind, summary, params, status: 'running' },
          };
          setTurns(previous => [...previous, cardTurn]);

          let result: unknown;

          await (async () => {
            result = await tool.execute(params);
            patchAction(cardTurn.id, { status: 'done', result });
          })().catch(async cause => {
            const message = cause instanceof Error ? cause.message : 'unknown error';
            patchAction(cardTurn.id, { status: 'error', errorMessage: message });
            result = { error: message };
          });

          toSave.push({
            role: 'tool',
            content: parsed.reply,
            actionPayload: {
              name: tool.name,
              params: params as Record<string, unknown>,
              status: 'done',
            },
          });

          if (tool.kind === 'ui' || rounds >= MAX_READ_ROUNDS) {
            // UI actions need no synthesis round; read results past the cap
            // would loop the model, so the card's reply is the final answer.
            break;
          }

          messages.push(
            {
              role: 'assistant',
              content: JSON.stringify({ reply: parsed.reply, action: { name: tool.name, params } }),
            },
            buildToolResultMessage(tool.name, result),
          );
        }

        await persist(question, toSave);
      })()
        .catch(async cause => {
          setError(cause instanceof Error ? cause.message : 'generation failed');
          setTurns(previous =>
            previous.filter(turn => turn.id !== userTurn.id || turn.role === 'user'),
          );
        })
        .finally(async () => {
          setBusy(false);
        });
    },
    [engine, busy, persist, patchAction, currentWorkspace?.currency],
  );

  /** Runs a previously proposed write action after the user's explicit tap. */
  const confirmAction = useCallback(
    async (turnId: string): Promise<void> => {
      const pending = pendingRef.current.get(turnId);
      if (!pending) {
        return;
      }
      pendingRef.current.delete(turnId);
      patchAction(turnId, { status: 'running' });

      await (async () => {
        const result = await pending.tool.execute(pending.params);
        patchAction(turnId, { status: 'done', result });
        if (chatId) {
          await chatsApi
            .appendMessage(chatId, 'tool', '', {
              name: pending.tool.name,
              params: pending.params as Record<string, unknown>,
              status: 'done',
            })
            .catch(() => setUnsaved(true));
        }
      })().catch(async cause => {
        const message = cause instanceof Error ? cause.message : 'unknown error';
        patchAction(turnId, { status: 'error', errorMessage: message });
      });
    },
    [chatId, patchAction],
  );

  const cancelAction = useCallback(
    (turnId: string): void => {
      if (pendingRef.current.delete(turnId)) {
        patchAction(turnId, { status: 'cancelled' });
      }
    },
    [patchAction],
  );

  const startNew = useCallback(() => {
    setTurns([]);
    setError(null);
    setChatId(null);
    setUnsaved(false);
    pendingRef.current.clear();
  }, []);

  return { turns, busy, error, chatId, unsaved, send, stop, confirmAction, cancelAction, startNew };
}
