'use client';

import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from '@/app/components/icons';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { greetingName } from '@/app/components/welcome-window/greeting-name';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { DashboardCard } from './ui';
import { type SetupProgress, useSetupProgress } from './use-setup-progress';

type GettingStartedState = {
  gettingStartedDismissedAt?: string;
  gettingStartedCompletedAt?: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const readGettingStarted = (saved: Readonly<Record<string, unknown>>): GettingStartedState => ({
  gettingStartedDismissedAt: stringOrUndefined(saved.gettingStartedDismissedAt),
  gettingStartedCompletedAt: stringOrUndefined(saved.gettingStartedCompletedAt),
});

type StepId = 'upload' | 'categories' | 'budget' | 'goal' | 'telegram';

const STEPS: ReadonlyArray<{
  id: StepId;
  doneWhen: keyof SetupProgress;
  /** Listed only when this holds: connecting Telegram needs a bot to connect to. */
  shownWhen?: keyof SetupProgress;
  href: string;
  emoji: string;
}> = [
  { id: 'upload', doneWhen: 'hasUpload', href: '/statements?openExpenseDrawer=scan', emoji: '📄' },
  {
    id: 'categories',
    doneWhen: 'hasCustomCategories',
    href: '/categories',
    emoji: '✨',
  },
  { id: 'budget', doneWhen: 'hasBudget', href: '/budgets', emoji: '💰' },
  { id: 'goal', doneWhen: 'hasGoal', href: '/goals', emoji: '🎯' },
  {
    id: 'telegram',
    doneWhen: 'hasTelegram',
    shownWhen: 'telegramAvailable',
    href: '/settings/profile?tab=notifications&section=telegram',
    emoji: '✈️',
  },
];

const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}): React.JSX.Element {
  return (
    <div className="seneca-getting-started__ring" role="img" aria-label={label}>
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle className="seneca-getting-started__ring-track" cx="20" cy="20" r={RING_RADIUS} />
        <circle
          className="seneca-getting-started__ring-fill"
          cx="20"
          cy="20"
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - done / total)}
        />
      </svg>
      <span aria-hidden="true">
        {done}/{total}
      </span>
    </div>
  );
}

interface StepRowProps {
  step: (typeof STEPS)[number] & { done: boolean };
  isNext: boolean;
}

function StepRow({ step, isNext }: StepRowProps): React.JSX.Element {
  const t = useIntlayer('gettingStartedCard');
  const text: Record<StepId, { title: React.ReactNode; subtitle: React.ReactNode }> = {
    upload: { title: t.uploadTitle, subtitle: t.uploadSubtitle },
    categories: { title: t.categoriesTitle, subtitle: t.categoriesSubtitle },
    budget: { title: t.budgetTitle, subtitle: t.budgetSubtitle },
    goal: { title: t.goalTitle, subtitle: t.goalSubtitle },
    telegram: { title: t.telegramTitle, subtitle: t.telegramSubtitle },
  };
  return (
    <Link
      href={step.href}
      className={clsx(
        'seneca-getting-started__step',
        step.done && 'seneca-getting-started__step--done',
      )}
    >
      <span className="seneca-getting-started__check" aria-hidden="true">
        {step.done && <Check size={12} />}
      </span>
      <span className="seneca-getting-started__step-body">
        <span className="seneca-getting-started__step-title">
          {text[step.id].title}
          <span aria-hidden="true">{step.emoji}</span>
          {isNext && <span className="seneca-getting-started__next">{t.next}</span>}
        </span>
        <span className="seneca-getting-started__step-sub">{text[step.id].subtitle}</span>
      </span>
      <ChevronRight size={16} className="seneca-dashboard__action-chevron" />
    </Link>
  );
}

/**
 * The first things a new workspace should do, ticked off from its own data.
 * Gone for good, per person and workspace, once every step is done or the
 * person says they'll find their own way.
 */
export function GettingStartedCard(): React.JSX.Element | null {
  const t = useIntlayer('gettingStartedCard');
  const { user } = useAuth();
  const { state, save } = useViewPreference('onboarding', readGettingStarted);
  const progress = useSetupProgress();
  const [showCompleted, setShowCompleted] = useState(false);

  const finished = Boolean(state?.gettingStartedDismissedAt || state?.gettingStartedCompletedAt);
  const visible = progress ? STEPS.filter(step => !step.shownWhen || progress[step.shownWhen]) : [];
  const allDone = progress ? visible.every(step => progress[step.doneWhen]) : false;

  // Remembered, so deleting the only goal later doesn't bring the checklist back.
  useEffect(() => {
    if (allDone && state !== undefined && !finished) {
      save({ ...state, gettingStartedCompletedAt: new Date().toISOString() });
    }
  }, [allDone, state, finished, save]);

  if (state === undefined || !progress || finished || allDone) {
    return null;
  }

  const steps = visible.map(step => ({ ...step, done: progress[step.doneWhen] }));
  const completed = steps.filter(step => step.done);
  const open = steps.filter(step => !step.done);
  const firstName = greetingName(user?.name);
  // A function, so a `$` in the name is not read as a replacement pattern.
  const subtitle = firstName
    ? t.subtitle.value.replace('{{name}}', () => firstName)
    : t.subtitleNoName.value;
  const progressLabel = t.progressLabel.value
    .replace('{{done}}', String(completed.length))
    .replace('{{total}}', String(steps.length));

  return (
    <DashboardCard
      title={t.title}
      subtitle={subtitle}
      action={<ProgressRing done={completed.length} total={steps.length} label={progressLabel} />}
      className="seneca-getting-started"
    >
      {completed.length > 0 && (
        <>
          <button
            type="button"
            className="seneca-getting-started__toggle"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted(value => !value)}
          >
            {t.completedItems} ({completed.length})
            <ChevronDown
              size={14}
              className={clsx(
                'seneca-getting-started__toggle-icon',
                showCompleted && 'seneca-getting-started__toggle-icon--open',
              )}
            />
          </button>
          {showCompleted &&
            completed.map(step => <StepRow key={step.id} step={step} isNext={false} />)}
        </>
      )}
      {open.map((step, index) => (
        <StepRow key={step.id} step={step} isNext={index === 0} />
      ))}
      <div className="seneca-getting-started__footer">
        <button
          type="button"
          className="seneca-getting-started__dismiss"
          onClick={() => save({ ...state, gettingStartedDismissedAt: new Date().toISOString() })}
        >
          {t.exploreOnMyOwn}
        </button>
      </div>
    </DashboardCard>
  );
}
