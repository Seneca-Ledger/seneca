'use client';

import { useEffect, useState } from 'react';
import { AVAILABLE_BACKGROUNDS } from '@/app/(main)/workspaces/constants';
import type { User } from '@/app/contexts/AuthContext';
import apiClient from '@/app/lib/api';
import type { AppLocale } from '@/app/lib/locale';
import { resolveOnboardingBootstrapLocale } from '../lib/locale-bootstrap';
import type { OnboardingData } from '../useOnboardingWizard';

export function detectTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** One of the bundled photos, so a workspace created here never shows "No background selected". */
export function randomBackground(random: () => number = Math.random): string {
  return AVAILABLE_BACKGROUNDS[Math.floor(random() * AVAILABLE_BACKGROUNDS.length)];
}

interface WorkspaceRow {
  id?: string;
  name?: string;
  currency?: string | null;
  backgroundImage?: string | null;
  settings?: { profile?: unknown } | null;
}

/** The list endpoint answers either bare or in a `{ data }` envelope. */
function pickWorkspace(
  payload: unknown,
  workspaceId: string | null | undefined,
): WorkspaceRow | null {
  const envelope = payload as { data?: unknown } | null;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(envelope?.data)
      ? envelope.data
      : [];
  const workspaces = rows as WorkspaceRow[];
  return workspaces.find(item => item?.id === workspaceId) ?? workspaces[0] ?? null;
}

/** What the account's own workspace already says, as answers to pre-fill. */
export function answersFromWorkspace(workspace: WorkspaceRow | null): Partial<OnboardingData> {
  const answers: Partial<OnboardingData> = {};
  if (workspace?.name) {
    answers.workspaceName = workspace.name;
  }
  if (workspace?.currency) {
    answers.workspaceCurrency = String(workspace.currency).toUpperCase();
  }
  // A background someone already chose stays; only an empty one gets the random pick.
  if (workspace?.backgroundImage) {
    answers.workspaceBackgroundImage = workspace.backgroundImage;
  }
  // Only an explicit choice: a workspace without one reads as business, but the
  // question still has to be asked.
  const profile = workspace?.settings?.profile;
  if (profile === 'home' || profile === 'business') {
    answers.profile = profile;
  }
  return answers;
}

interface BootstrapOptions {
  user: User | null;
  /** False while auth loads or while the page is about to redirect away. */
  enabled: boolean;
  appLocale: string;
  /** Another workspace is being created: nothing of the current one carries over. */
  isCreateWorkspaceFlow: boolean;
  onReady: (answers: Partial<OnboardingData>, locale: AppLocale) => void;
}

/**
 * Fills the answers once from what the account already has, then leaves them
 * to the user. A failed workspace read still lets the wizard start, with defaults.
 */
export function useOnboardingBootstrap({
  user,
  enabled,
  appLocale,
  isCreateWorkspaceFlow,
  onReady,
}: BootstrapOptions): { ready: boolean; workspaceLoadFailed: boolean } {
  const [ready, setReady] = useState(false);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);

  useEffect(() => {
    if (!(enabled && user) || ready) {
      return;
    }

    let cancelled = false;
    const locale = resolveOnboardingBootstrapLocale(appLocale);
    const fromUser: Partial<OnboardingData> = {
      locale,
      timeZone: user.timeZone || detectTimeZone(),
      dateFormat: user.dateFormat ?? 'auto',
      firstDayOfWeek: user.firstDayOfWeek ?? null,
      workspaceName: `${user.name || user.email} workspace`,
      workspaceBackgroundImage: randomBackground(),
    };

    const finish = (fromWorkspace: Partial<OnboardingData>) => {
      if (cancelled) {
        return;
      }
      onReady({ ...fromUser, ...fromWorkspace }, locale);
      setReady(true);
    };

    if (isCreateWorkspaceFlow) {
      finish({});
      return;
    }

    apiClient
      .get('/workspaces')
      .then(response =>
        finish(answersFromWorkspace(pickWorkspace(response.data, user.workspaceId))),
      )
      .catch(() => {
        if (!cancelled) {
          setWorkspaceLoadFailed(true);
        }
        finish({});
      });

    return () => {
      cancelled = true;
    };
  }, [appLocale, enabled, isCreateWorkspaceFlow, onReady, ready, user]);

  return { ready, workspaceLoadFailed };
}
