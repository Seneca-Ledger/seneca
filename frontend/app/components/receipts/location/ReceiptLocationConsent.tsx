'use client';

import { useState } from 'react';
import { MapPin } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { requestLocationAccess } from '@/app/lib/device-location';
import { setReceiptLocationCapture } from '@/app/lib/receipt-location-capture';
import { tokens } from '@/lib/theme-tokens';

type ConsentStep = 'ask' | 'requesting' | 'granted' | 'denied';

type ReceiptLocationConsentProps = {
  onOpenCamera: () => void;
};

const buttonBase: React.CSSProperties = {
  display: 'flex',
  minHeight: 56,
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: tokens.radius.md,
  padding: '14px 20px',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  border: 'none',
  background: 'var(--primary-fill)',
  color: '#fff',
};

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--border-color)',
  background: 'var(--card-bg)',
  color: 'var(--foreground)',
};

/**
 * Asked once per device, right before the first camera shot. The browser's own
 * prompt is triggered from the Allow click, so it appears here rather than on
 * top of the camera app, where people tend to dismiss it.
 */
export function ReceiptLocationConsent({
  onOpenCamera,
}: ReceiptLocationConsentProps): React.JSX.Element {
  const t = useIntlayer('receiptLocationConsent');
  const [step, setStep] = useState<ConsentStep>('ask');

  const handleAllow = async (): Promise<void> => {
    setStep('requesting');
    const access = await requestLocationAccess();
    // "unavailable" is a missing fix or an unanswered prompt, not a refusal:
    // the user agreed, so capture stays on and retries at the next shot.
    const allowed = access !== 'denied';
    setReceiptLocationCapture(allowed);
    setStep(allowed ? 'granted' : 'denied');
  };

  const handleNotNow = (): void => {
    setReceiptLocationCapture(false);
    // Still inside the click, so the browser lets the camera input open.
    onOpenCamera();
  };

  const isResult = step === 'granted' || step === 'denied';
  const title = {
    ask: t.title.value,
    requesting: t.title.value,
    granted: t.grantedTitle.value,
    denied: t.deniedTitle.value,
  }[step];

  return (
    <section
      aria-labelledby="receipt-location-consent-title"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'var(--primary-soft-bg, rgba(var(--primary-rgb),0.1))',
          color: step === 'denied' ? 'var(--muted-foreground)' : 'var(--primary-fill)',
        }}
      >
        <MapPin size={24} />
      </div>

      <h3
        id="receipt-location-consent-title"
        style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}
      >
        {title}
      </h3>

      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--foreground)' }}>
        {step === 'granted' ? t.grantedBody.value : null}
        {step === 'denied' ? t.deniedBody.value : null}
        {isResult ? null : t.body.value}
      </p>

      {isResult ? null : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
          {t.privacy.value}
        </p>
      )}

      {step === 'ask' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button type="button" style={primaryButton} onClick={() => void handleAllow()}>
            {t.allow.value}
          </button>
          <button type="button" style={secondaryButton} onClick={handleNotNow}>
            {t.notNow.value}
          </button>
        </div>
      ) : null}

      {step === 'requesting' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: 'var(--muted-foreground)',
          }}
        >
          <Spinner className="size-[18px]" />
          {t.requesting.value}
        </div>
      ) : null}

      {isResult ? (
        // A new click: after the browser prompt the page no longer has the user
        // activation it needs to open the camera on its own.
        <button type="button" style={{ ...primaryButton, marginTop: 4 }} onClick={onOpenCamera}>
          {t.openCamera.value}
        </button>
      ) : null}
    </section>
  );
}
