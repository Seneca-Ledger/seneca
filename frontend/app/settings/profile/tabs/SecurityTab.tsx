'use client';

import Stack from '@mui/material/Stack';
import type React from 'react';
import { Lock, Mail, Shield, ShieldCheck } from '@/app/components/icons';
import { useUserFormat } from '@/app/lib/user-format-store';
import { EmailSection } from '@/app/settings/profile/components/EmailSection';
import { PasswordSection } from '@/app/settings/profile/components/PasswordSection';
import { SessionsSection } from '@/app/settings/profile/components/SessionsSection';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { TwoFactorSection } from '@/app/settings/profile/components/TwoFactorSection';
import { resolveOpenSection } from '@/app/settings/profile/helpers/settings-url-state';
import { useEmailForm } from '@/app/settings/profile/hooks/useEmailForm';
import { usePasswordForm } from '@/app/settings/profile/hooks/usePasswordForm';
import { useSessions } from '@/app/settings/profile/hooks/useSessions';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { useTwoFactor } from '@/app/settings/profile/hooks/useTwoFactor';

import type { SettingsTabProps } from './types';

// eslint-disable-next-line max-lines-per-function
export function SecurityTab({ section, user }: SettingsTabProps): React.JSX.Element {
  const { t, tx } = useSettingsText();
  const { preferences: formatPreferences } = useUserFormat();
  const isAuthenticated = !!user;
  const openSection = resolveOpenSection('security', section);

  const {
    email,
    setEmail,
    emailPassword,
    setEmailPassword,
    emailMessage,
    emailError,
    emailLoading,
    handleEmailSubmit,
  } = useEmailForm(user, {
    passwordRequired: t.validation.passwordRequiredForEmail.value,
    successFallback: t.emailCard.successFallback.value,
    errorFallback: t.emailCard.errorFallback.value,
  });

  const {
    passwords,
    setPasswords,
    passwordMessage,
    passwordError,
    passwordLoading,
    handlePasswordSubmit,
  } = usePasswordForm({
    mismatch: t.validation.passwordMismatch.value,
    confirmSubmit: tx(
      ['passwordCard', 'confirmSubmit'],
      'Update password now? You may need to sign in again on other devices.',
    ),
    successFallback: t.passwordCard.successFallback.value,
    errorFallback: t.passwordCard.errorFallback.value,
  });

  const twoFactor = useTwoFactor(isAuthenticated, {
    loadError: tx(['securityCard', 'loadError'], 'Failed to load two-factor status'),
    enabledMessage: tx(['securityCard', 'enabledMessage'], 'Two-factor authentication enabled'),
    disabledMessage: tx(['securityCard', 'disabledMessage'], 'Two-factor authentication disabled'),
    errorFallback: tx(['securityCard', 'errorFallback'], 'Two-factor action failed'),
  });

  const {
    sessions,
    sessionsLoading,
    sessionsError,
    sessionsMessage,
    logoutSessionLoadingId,
    handleLogoutSession,
    handleLogoutAll,
  } = useSessions(isAuthenticated, {
    loadError: tx(['sessionsCard', 'sessionsLoadError'], 'Failed to load sessions'),
    logoutAllConfirm: tx(
      ['sessionsCard', 'logoutAllConfirm'],
      'Log out of all devices? You will need to sign in again on each device.',
    ),
    logoutCurrentConfirm: tx(
      ['sessionsCard', 'logoutCurrentConfirm'],
      'Log out on this device? You will need to sign in again.',
    ),
    logoutSessionConfirm: tx(
      ['sessionsCard', 'logoutSessionConfirm'],
      'Log out this device session?',
    ),
    sessionLogoutSuccess: tx(['sessionsCard', 'sessionLogoutSuccess'], 'Session logged out'),
    sessionLogoutError: tx(['sessionsCard', 'sessionLogoutError'], 'Failed to log out session'),
  });

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        id="email"
        title={t.emailCard.title.value}
        icon={Mail}
        defaultExpanded={openSection === 'email'}
      >
        <EmailSection
          t={t}
          email={email}
          setEmail={setEmail}
          emailPassword={emailPassword}
          setEmailPassword={setEmailPassword}
          emailMessage={emailMessage}
          emailError={emailError}
          emailLoading={emailLoading}
          handleEmailSubmit={handleEmailSubmit}
        />
      </SettingsAccordion>

      <SettingsAccordion
        id="password"
        title={t.passwordCard.title.value}
        icon={Lock}
        defaultExpanded={openSection === 'password'}
      >
        <PasswordSection
          t={t}
          tx={tx}
          passwordMessage={passwordMessage}
          passwordError={passwordError}
          passwordLoading={passwordLoading}
          passwords={passwords}
          setPasswords={setPasswords}
          handlePasswordSubmit={handlePasswordSubmit}
        />
      </SettingsAccordion>

      <SettingsAccordion
        id="two-factor"
        title={tx(['securityCard', 'title'], 'Two-factor authentication')}
        description={tx(
          ['securityCard', 'description'],
          'Ask for a one-time code from your authenticator app on every login.',
        )}
        icon={ShieldCheck}
        defaultExpanded={openSection === 'two-factor'}
      >
        <TwoFactorSection
          tx={tx}
          twoFactor={twoFactor}
          email={user.email}
          formatPreferences={formatPreferences}
        />
      </SettingsAccordion>

      <SettingsAccordion
        id="sessions"
        title={t.sessionsCard.title.value}
        description={t.sessionsCard.logoutAllHelp.value}
        icon={Shield}
        defaultExpanded={openSection === 'sessions'}
      >
        <SessionsSection
          t={t}
          tx={tx}
          sessionsMessage={sessionsMessage}
          sessionsError={sessionsError}
          sessionsLoading={sessionsLoading}
          sessions={sessions}
          userLastLogin={user?.lastLogin}
          logoutSessionLoadingId={logoutSessionLoadingId}
          handleLogoutSession={handleLogoutSession}
          handleLogoutAll={handleLogoutAll}
          formatPreferences={formatPreferences}
        />
      </SettingsAccordion>
    </Stack>
  );
}
