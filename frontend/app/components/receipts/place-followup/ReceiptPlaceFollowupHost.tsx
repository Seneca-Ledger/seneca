'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { setReceiptPlacePrompt } from '@/app/lib/receipt-place-followup';
import { ReceiptPlacePrompt } from './ReceiptPlacePrompt';
import { type PlaceQuestion, useReceiptPlaceFollowup } from './useReceiptPlaceFollowup';

// The drawer pulls in the map, so it loads only once there is a question.
const ReceiptPlacePickerDrawer = dynamic(
  () => import('./ReceiptPlacePickerDrawer').then(module => module.ReceiptPlacePickerDrawer),
  { ssr: false },
);

const summarize = (question: PlaceQuestion, locale: string): string | null => {
  const { vendor, amount, currency } = question.suggestions;
  const money =
    typeof amount === 'number' && currency ? formatMoney(amount, currency, locale) : null;
  return [vendor, money].filter(Boolean).join(' · ') || null;
};

/**
 * Mounted once in the root layout. When GPS comes back after a receipt was
 * shot without it, asks which shop it was: a toast first, the list of nearby
 * places in a drawer on request.
 */
export function ReceiptPlaceFollowupHost(): React.JSX.Element | null {
  const { question, finish } = useReceiptPlaceFollowup();
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = useIntlayer('receiptPlaceFollowup');
  const { locale } = useLocale();
  const summary = question ? summarize(question, String(locale)) : null;

  const title = t.promptTitle.value;
  const body = t.promptBody.value;
  const choose = t.choosePlace.value;
  const close = t.close.value;
  const dontShowAgain = t.dontShowAgain.value;
  const turnedOff = t.turnedOff.value;

  useEffect(() => {
    if (!question || pickerOpen) {
      return undefined;
    }
    const toastId = `receipt-place-${question.statementId}`;
    const promptLabels = { title, body, choose, close, dontShowAgain };
    toast.custom(
      toastState => (
        <ReceiptPlacePrompt
          visible={toastState.visible}
          summary={summary}
          labels={promptLabels}
          onChoose={() => {
            toast.dismiss(toastId);
            setPickerOpen(true);
          }}
          onClose={() => {
            toast.dismiss(toastId);
            finish(question.statementId);
          }}
          onDontShowAgain={() => {
            toast.dismiss(toastId);
            setReceiptPlacePrompt(false);
            finish(question.statementId);
            toast(turnedOff, { duration: 6000 });
          }}
        />
      ),
      { id: toastId, duration: Number.POSITIVE_INFINITY },
    );
    return () => toast.dismiss(toastId);
  }, [question, pickerOpen, summary, title, body, choose, close, dontShowAgain, turnedOff, finish]);

  if (!question) {
    return null;
  }

  const done = (): void => {
    setPickerOpen(false);
    finish(question.statementId);
  };

  return (
    <ReceiptPlacePickerDrawer
      key={question.statementId}
      open={pickerOpen}
      question={question}
      summary={summary}
      onClose={done}
      onSaved={done}
    />
  );
}
