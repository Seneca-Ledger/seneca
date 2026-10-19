'use client';

import type React from 'react';
import { createElement, useState } from 'react';
import { OnboardingNavigation } from '@/app/(onboarding)/onboarding/components/OnboardingNavigation';
import { useIntlayer } from '@/app/i18n';
import { ClientStep } from './steps/ClientStep';
import { DatesStep } from './steps/DatesStep';
import { ExtrasStep } from './steps/ExtrasStep';
import { ItemsStep } from './steps/ItemsStep';
import { ReviewStep } from './steps/ReviewStep';
import { TaxStep } from './steps/TaxStep';
import { type InvoiceForm, isLineComplete } from './useInvoiceForm';
import { WizardHeading, WizardProgress } from './WizardChrome';

const STEPS = ['client', 'items', 'tax', 'dates', 'extras', 'review'] as const;
type StepKey = (typeof STEPS)[number];
const REVIEW = STEPS.length - 1;

const STEP_VIEWS: Record<Exclude<StepKey, 'review'>, React.ComponentType<{ form: InvoiceForm }>> = {
  client: ClientStep,
  items: ItemsStep,
  tax: TaxStep,
  dates: DatesStep,
  extras: ExtrasStep,
};

/** Only who pays and what for are required; the rest has defaults or may stay empty. */
function isStepBlocked(key: StepKey, form: InvoiceForm): boolean {
  switch (key) {
    case 'client':
      return !form.clientId;
    case 'items':
      return form.lineItems.length === 0 || !form.lineItems.every(isLineComplete);
    case 'review':
      return !form.canSave;
    default:
      return false;
  }
}

interface InvoiceWizardProps {
  form: InvoiceForm;
  /** A saved draft is already filled in: it opens on the review. */
  startAtReview: boolean;
  saving: boolean;
  onSave: () => void;
}

/**
 * A new or draft invoice, asked one topic at a time: who pays, for what, tax,
 * dates, the optional rest, then a review to save from.
 */
export function InvoiceWizard({
  form,
  startAtReview,
  saving,
  onSave,
}: InvoiceWizardProps): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const [step, setStep] = useState(startAtReview ? REVIEW : 0);
  // Reached from the review's "Edit": Continue goes straight back to it.
  const [fromReview, setFromReview] = useState(false);
  const key: StepKey = STEPS[step];

  const headings: Record<StepKey, { title: string; subtitle: string }> = {
    client: { title: t.client.title.value, subtitle: t.client.subtitle.value },
    items: { title: t.items.title.value, subtitle: t.items.subtitle.value },
    tax: { title: t.tax.title.value, subtitle: t.tax.subtitle.value },
    dates: { title: t.dates.title.value, subtitle: t.dates.subtitle.value },
    extras: { title: t.extras.title.value, subtitle: t.extras.subtitle.value },
    review: { title: t.review.title.value, subtitle: t.review.subtitle.value },
  };

  const goTo = (next: number): void => {
    setStep(next);
    if (next === REVIEW) {
      setFromReview(false);
    }
  };

  const handleNext = (): void => {
    if (key === 'review') {
      onSave();
      return;
    }
    goTo(fromReview ? REVIEW : step + 1);
  };

  const handleEdit = (section: StepKey): void => {
    setFromReview(true);
    setStep(STEPS.indexOf(section));
  };

  const nextLabel =
    key === 'review' ? t.saveDraft.value : fromReview ? t.backToReview.value : t.next.value;

  return (
    <div className="seneca-invoice-wizard">
      <WizardProgress
        current={step}
        labels={STEPS.map(entry => t.stepNames[entry].value)}
        progressLabel={String(t.progress.value)
          .replace('{current}', String(step + 1))
          .replace('{total}', String(STEPS.length))}
      />
      {/* Keyed by step: each one mounts fresh and its heading takes focus. */}
      <div key={key} className="seneca-invoice-wizard__step">
        <WizardHeading title={headings[key].title} subtitle={headings[key].subtitle} />
        <div className="seneca-invoice-wizard__body">
          {key === 'review' ? (
            <ReviewStep form={form} onEdit={handleEdit} />
          ) : (
            createElement(STEP_VIEWS[key], { form })
          )}
        </div>
      </div>
      <OnboardingNavigation
        canGoBack={step > 0}
        isSubmitting={saving}
        nextDisabled={isStepBlocked(key, form)}
        onBack={() => goTo(step - 1)}
        onNext={handleNext}
        onSkip={key === 'extras' && !fromReview ? () => goTo(REVIEW) : undefined}
        labels={{
          back: page.actions.back.value,
          next: nextLabel,
          skip: t.skip.value,
          saving: page.actions.saving.value,
        }}
      />
    </div>
  );
}
