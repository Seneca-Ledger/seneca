'use client';

import { Alert, Box, CircularProgress } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { enterSx } from '@/app/components/welcome-tutorial/welcome-tutorial.styles';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { type AppLocale, normalizeLocale, syncLocaleFromUser } from '@/app/lib/locale';
import { DisclaimerGate, useDisclaimerAcceptance } from './components/DisclaimerGate';
import { OnboardingLayout } from './components/OnboardingLayout';
import { OnboardingNavigation } from './components/OnboardingNavigation';
import { OnboardingPreview } from './components/OnboardingPreview';
import { OnboardingProgress } from './components/OnboardingProgress';
import { detectTimeZone, useOnboardingBootstrap } from './hooks/useOnboardingBootstrap';
import {
  canLeaveStep,
  type OnboardingMode,
  type OnboardingStepKey,
  resolveOnboardingFlow,
  visibleSteps,
} from './lib/onboarding-flow';
import { submitOnboarding } from './lib/onboarding-submit';
import { useOnboardingText } from './lib/useOnboardingText';
import { BusinessStep } from './steps/BusinessStep';
import { CompletionStep } from './steps/CompletionStep';
import { LanguageStep } from './steps/LanguageStep';
import { TaxStep } from './steps/TaxStep';
import { WorkspaceStep } from './steps/WorkspaceStep';
import {
  EMPTY_BUSINESS_DETAILS,
  type OnboardingData,
  useOnboardingWizard,
} from './useOnboardingWizard';

const DEFAULT_CURRENCY = 'USD';

function FullScreenSpinner() {
  return (
    <Box
      sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}
    >
      <CircularProgress size={32} color="primary" />
    </Box>
  );
}

interface StepViewProps {
  stepKey: OnboardingStepKey;
  data: OnboardingData;
  mode: OnboardingMode;
  userName?: string | null;
  updateData: (patch: Partial<OnboardingData>) => void;
  onLocaleChange: (locale: AppLocale) => void;
  onProfileChange: (profile: WorkspaceProfile) => void;
  onCurrencyPickerOpenChange: (open: boolean) => void;
  onDeferTax: () => void;
}

/** The current step's questions, wired to the shared answers. */
function StepView({
  stepKey,
  data,
  mode,
  userName,
  updateData,
  onLocaleChange,
  onProfileChange,
  onCurrencyPickerOpenChange,
  onDeferTax,
}: StepViewProps) {
  switch (stepKey) {
    case 'language':
      return (
        <LanguageStep
          locale={data.locale}
          timeZone={data.timeZone}
          dateFormat={data.dateFormat}
          firstDayOfWeek={data.firstDayOfWeek}
          name={userName}
          onLocaleChange={onLocaleChange}
          onTimeZoneChange={timeZone => updateData({ timeZone })}
          onDateFormatChange={dateFormat => updateData({ dateFormat })}
          onFirstDayOfWeekChange={firstDayOfWeek => updateData({ firstDayOfWeek })}
        />
      );
    case 'workspace':
      return (
        <WorkspaceStep
          locale={data.locale}
          workspaceName={data.workspaceName}
          workspaceCurrency={data.workspaceCurrency}
          profile={data.profile}
          onWorkspaceNameChange={workspaceName => updateData({ workspaceName })}
          onWorkspaceCurrencyChange={workspaceCurrency => updateData({ workspaceCurrency })}
          onProfileChange={onProfileChange}
          onCurrencyPickerOpenChange={onCurrencyPickerOpenChange}
          // Creating another workspace skips the language step, so it is asked here.
          onLocaleChange={mode === 'create-workspace' ? onLocaleChange : undefined}
        />
      );
    case 'tax':
      return (
        <TaxStep
          locale={data.locale}
          profile={data.profile}
          taxCountry={data.taxCountry}
          taxpayerType={data.taxpayerType}
          // Without a country there is no taxpayer kind to keep.
          onTaxCountryChange={taxCountry =>
            updateData(taxCountry ? { taxCountry } : { taxCountry, taxpayerType: null })
          }
          onTaxpayerTypeChange={taxpayerType => updateData({ taxpayerType })}
          onDefer={onDeferTax}
        />
      );
    case 'business':
      return (
        <BusinessStep
          locale={data.locale}
          taxCountry={data.taxCountry}
          business={data.business}
          onChange={patch => updateData({ business: { ...data.business, ...patch } })}
        />
      );
    default:
      return <CompletionStep data={data} mode={mode} />;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setLocale, locale: appLocale } = useLocale();
  const { user, loading: authLoading, setUser } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const flow = resolveOnboardingFlow(searchParams.get('mode'), user?.onboardingCompletedAt);
  const isCreateWorkspaceFlow = flow.mode === 'create-workspace';

  const { currentStep, setCurrentStep, data, updateData } = useOnboardingWizard({
    locale: normalizeLocale(appLocale),
    timeZone: detectTimeZone(),
    dateFormat: 'auto',
    firstDayOfWeek: null,
    workspaceName: '',
    workspaceCurrency: DEFAULT_CURRENCY,
    workspaceBackgroundImage: null,
    profile: null,
    taxCountry: null,
    taxpayerType: null,
    business: EMPTY_BUSINESS_DETAILS,
  });
  const text = useOnboardingText(data.locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const {
    loading: disclaimerLoading,
    accepted: disclaimerAccepted,
    markAccepted: markDisclaimerAccepted,
  } = useDisclaimerAcceptance();

  const stepKeys = visibleSteps(flow.stepKeys, data.profile);
  const stepKey = stepKeys[Math.min(currentStep, stepKeys.length - 1)];
  const isLastStep = currentStep >= stepKeys.length - 1;

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.onboardingCompletedAt && flow.shouldRedirectCompletedUser) {
      router.replace(DEFAULT_APP_ROUTE);
    }
  }, [authLoading, flow.shouldRedirectCompletedUser, router, user]);

  useEffect(() => {
    if (!user?.workspaceId) {
      return;
    }
    if (!localStorage.getItem('currentWorkspaceId')) {
      localStorage.setItem('currentWorkspaceId', user.workspaceId);
    }
  }, [user?.workspaceId]);

  const handleBootstrapReady = useCallback(
    (answers: Partial<OnboardingData>, locale: AppLocale) => {
      updateData(answers);
      setLocale(locale);
    },
    [setLocale, updateData],
  );
  const { ready: bootstrapComplete, workspaceLoadFailed } = useOnboardingBootstrap({
    user,
    enabled: !(authLoading || (user?.onboardingCompletedAt && flow.shouldRedirectCompletedUser)),
    appLocale,
    isCreateWorkspaceFlow,
    onReady: handleBootstrapReady,
  });

  const goTo = useCallback(
    (index: number) => {
      setCurrentStep(Math.max(0, Math.min(index, stepKeys.length - 1)));
    },
    [setCurrentStep, stepKeys.length],
  );

  const handleProfileChange = (profile: WorkspaceProfile) => {
    updateData({
      profile,
      // A household does not file as a company; that option disappears with the choice.
      ...(profile === 'home' && data.taxpayerType === 'company' ? { taxpayerType: null } : {}),
    });
  };

  const handleFinish = async () => {
    setError('');
    setIsSubmitting(true);
    const workspaceId = user?.workspaceId ?? localStorage.getItem('currentWorkspaceId');

    try {
      const result = await submitOnboarding(apiClient, data, flow.mode, workspaceId);

      if (isCreateWorkspaceFlow) {
        localStorage.setItem('currentWorkspaceId', result.workspaceId);
      }
      if (result.user) {
        const updatedUser = result.user as NonNullable<typeof user>;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        syncLocaleFromUser(updatedUser, { overwrite: true });
        setUser(updatedUser);
      }
    } catch {
      setError(text(['errors', 'completeFailed'], 'Failed to save onboarding settings.'));
      setIsSubmitting(false);
      return;
    }

    // The sidebar reads the profile off the workspace list; a failed refresh only delays that.
    await refreshWorkspaces().catch(() => undefined);
    router.replace(isCreateWorkspaceFlow ? '/workspaces' : DEFAULT_APP_ROUTE);
  };

  const handleNext = () => {
    if (isLastStep) {
      void handleFinish();
      return;
    }
    goTo(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // Only reachable when creating another workspace: back to where it was started.
      router.back();
      return;
    }
    goTo(currentStep - 1);
  };

  const handleSkip = () => {
    // Skipping means "not now": nothing typed on this step gets saved.
    if (stepKey === 'business') {
      updateData({ business: EMPTY_BUSINESS_DETAILS });
    }
    goTo(currentStep + 1);
  };

  const handleDeferTax = () => {
    updateData({ taxCountry: null, taxpayerType: null });
    goTo(currentStep + 1);
  };

  if (
    authLoading ||
    !bootstrapComplete ||
    disclaimerLoading ||
    !user ||
    (user.onboardingCompletedAt && flow.shouldRedirectCompletedUser)
  ) {
    return <FullScreenSpinner />;
  }

  // Stands in front of the wizard rather than inside it: the wizard can be skipped
  // through, and consent that can be skipped records nothing.
  if (!disclaimerAccepted) {
    return (
      <DisclaimerGate
        title={text(['disclaimer', 'title'], 'Before you start')}
        intro={text(
          ['disclaimer', 'intro'],
          'Lumio helps you track and analyse your finances, but it does not replace an accountant, a tax adviser or a financial adviser.',
        )}
        points={[
          text(
            ['disclaimer', 'pointAccuracy'],
            'Calculations, categories and tax rates may be wrong or out of date. Check them before you file anything or make a financial decision.',
          ),
          text(
            ['disclaimer', 'pointResponsibility'],
            'You remain responsible for whatever you submit to government authorities.',
          ),
          text(
            ['disclaimer', 'pointNoWarranty'],
            'The app is provided as is, without warranties. We are not liable for losses arising from its use.',
          ),
          text(
            ['disclaimer', 'pointReport'],
            'If you spot an error in the data or the calculations, tell us and we will fix it.',
          ),
        ]}
        consentLabel={text(
          ['disclaimer', 'consent'],
          'I understand the above and accept these terms',
        )}
        acceptLabel={text(['disclaimer', 'accept'], 'I accept')}
        savingLabel={text(['disclaimer', 'saving'], 'Saving…')}
        errorLabel={text(
          ['disclaimer', 'error'],
          'Could not save your acknowledgement. Please try again.',
        )}
        onAccepted={markDisclaimerAccepted}
      />
    );
  }

  const stepLabels: Record<(typeof stepKeys)[number], string> = {
    language: text(['steps', 'language'], 'Language'),
    workspace: text(['steps', 'workspace'], 'Workspace'),
    tax: text(['steps', 'tax'], 'Taxes'),
    business: text(['steps', 'business'], 'Business'),
    completion: text(['steps', 'completion'], 'Done'),
  };

  return (
    <OnboardingLayout
      header={
        <OnboardingProgress
          currentStep={currentStep}
          stepLabels={stepKeys.map(key => stepLabels[key])}
          progressLabel={text(['progressLabel'], 'Step {current} of {total}')
            .replace('{current}', String(currentStep + 1))
            .replace('{total}', String(stepKeys.length))}
        />
      }
      aside={<OnboardingPreview stepKey={stepKey} data={data} />}
      footer={
        currencyPickerOpen ? null : (
          <OnboardingNavigation
            canGoBack={currentStep > 0 || isCreateWorkspaceFlow}
            isSubmitting={isSubmitting}
            nextDisabled={!canLeaveStep(stepKey, data.profile)}
            onBack={handleBack}
            onNext={handleNext}
            // The tax step has its own "not listed / decide later" in place of a bare Skip.
            onSkip={stepKey === 'business' ? handleSkip : undefined}
            labels={{
              back: text(['navigation', 'back'], 'Back'),
              next: isLastStep
                ? text(['navigation', 'finish'], 'Start using app')
                : text(['navigation', 'next'], 'Next'),
              skip: text(['navigation', 'skip'], 'Skip'),
              saving: text(['navigation', 'saving'], 'Saving...'),
            }}
          />
        )
      }
    >
      {error || workspaceLoadFailed ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || text(['errors', 'workspaceLoadFailed'], 'Failed to load workspace settings.')}
        </Alert>
      ) : null}

      {/* Keyed by step: each one mounts fresh, so it fades in and its heading takes focus. */}
      <Box key={stepKey} sx={enterSx}>
        <StepView
          stepKey={stepKey}
          data={data}
          mode={flow.mode}
          userName={user.name}
          updateData={updateData}
          onLocaleChange={nextLocale => {
            updateData({ locale: nextLocale });
            setLocale(nextLocale);
          }}
          onProfileChange={handleProfileChange}
          onCurrencyPickerOpenChange={setCurrencyPickerOpen}
          onDeferTax={handleDeferTax}
        />
      </Box>
    </OnboardingLayout>
  );
}
