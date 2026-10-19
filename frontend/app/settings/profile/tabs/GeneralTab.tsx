'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Palette, UserCircle } from '@/app/components/icons';
import { useLanguageSelection } from '@/app/components/navigation/hooks/useLanguageSelection';
import { LanguageDrawer } from '@/app/components/navigation/LanguageDrawer';
import { Alert } from '@/app/components/ui/alert';
import { useIntlayer, useLocale } from '@/app/i18n';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import { formatTimeZoneLabel } from '@/app/lib/timezone';
import {
  AppearanceSection,
  ThemeSection,
} from '@/app/settings/profile/components/AppearanceSection';
import { AvatarUploadButton } from '@/app/settings/profile/components/AvatarUploadButton';
import { ProfileSection } from '@/app/settings/profile/components/ProfileSection';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { TimeZoneDrawer } from '@/app/settings/profile/components/TimeZoneDrawer';
import { resolveOpenSection } from '@/app/settings/profile/helpers/settings-url-state';
import { useAppearance } from '@/app/settings/profile/hooks/useAppearance';
import { useAvatarUpload } from '@/app/settings/profile/hooks/useAvatarUpload';
import { useProfileForm } from '@/app/settings/profile/hooks/useProfileForm';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import {
  getInitials,
  resolveTimeZoneOptions,
  type TimeZoneOption,
} from '@/app/settings/profile/profileHelpers';

import type { SettingsTabProps } from './types';

// eslint-disable-next-line max-lines-per-function
export function GeneralTab({ section, user, setUser }: SettingsTabProps): React.JSX.Element {
  const { locale, availableLocales, setLocale } = useLocale();
  const { t, tx } = useSettingsText();
  const { userMenu, languageModal } = useIntlayer('navigation');

  const language = useLanguageSelection({
    locale,
    availableLocales,
    setLocale,
    languageModal,
    setMobileMenuOpen: () => {},
  });
  const openSection = resolveOpenSection('general', section);

  const [isTimeZoneModalOpen, setIsTimeZoneModalOpen] = useState(false);
  const [timeZoneSearch, setTimeZoneSearch] = useState('');
  const timeZoneOptions = useMemo(() => resolveTimeZoneOptions(), []);

  const {
    profileName,
    setProfileName,
    profileTimeZone,
    setProfileTimeZone,
    profileDateFormat,
    setProfileDateFormat,
    profileFirstDayOfWeek,
    setProfileFirstDayOfWeek,
    profileMessage,
    setProfileMessage,
    profileError,
    setProfileError,
    profileLoading,
    hasProfileChanges,
    handleProfileSubmit,
  } = useProfileForm(user, setUser, {
    successFallback: t.profileCard.successFallback.value,
    errorFallback: t.profileCard.errorFallback.value,
  });

  const {
    avatarError,
    setAvatarError,
    avatarUploading,
    avatarMessage,
    avatarErrorMessage,
    avatarInputRef,
    handleAvatarSelect,
  } = useAvatarUpload(user, setUser, {
    sizeError: tx(['profileCard', 'avatarSizeError'], 'Avatar file is too large'),
    updated: tx(['profileCard', 'avatarUpdated'], 'Avatar updated'),
    errorFallback: tx(['profileCard', 'avatarError'], 'Failed to update avatar'),
  });

  const {
    themePreference,
    appearanceMessage,
    appearanceError,
    appearanceLoading,
    handleThemePreferenceChange,
    density,
    setDensity,
    reduceMotion,
    setReduceMotion,
    showDailyQuote,
    setShowDailyQuote,
  } = useAppearance(user, setUser, {
    successFallback: t.appearanceCard.title.value,
    errorFallback: t.profileCard.errorFallback.value,
  });

  // Назвать 418 зон — это два формата Intl на каждую, ~0,4 с в главном потоке
  // на холодном ICU. Пока ящик закрыт, список не виден никому, поэтому он
  // строится на первом открытии; дальше отвечает кэш в formatTimeZoneLabel.
  const timeZoneSelectOptions = useMemo<TimeZoneOption[]>(() => {
    if (!isTimeZoneModalOpen) {
      return [];
    }
    const autoLabel = t.profileCard.timeZones.auto.value;
    const utcLabel = t.profileCard.timeZones.utc.value;
    return [
      { value: '', label: autoLabel },
      ...timeZoneOptions.map(zone => ({
        value: zone,
        label: zone === 'UTC' ? utcLabel : formatTimeZoneLabel(zone, locale),
      })),
    ];
  }, [isTimeZoneModalOpen, t, timeZoneOptions, locale]);

  // Считается из самой зоны, а не поиском по списку: иначе надпись на кнопке
  // зависела бы от того, открыт ящик или нет.
  const selectedTimeZoneOption = useMemo<TimeZoneOption>(() => {
    if (!profileTimeZone) {
      return { value: '', label: t.profileCard.timeZones.auto.value };
    }
    if (profileTimeZone === 'UTC') {
      return { value: 'UTC', label: t.profileCard.timeZones.utc.value };
    }
    return { value: profileTimeZone, label: formatTimeZoneLabel(profileTimeZone, locale) };
  }, [profileTimeZone, t, locale]);

  const filteredTimeZoneSelectOptions = useMemo(() => {
    const query = timeZoneSearch.trim().toLowerCase();
    if (!query) return timeZoneSelectOptions;
    return timeZoneSelectOptions.filter(option => option.label.toLowerCase().includes(query));
  }, [timeZoneSearch, timeZoneSelectOptions]);

  const handleTimeZoneChange = useCallback(
    (value: string) => {
      setProfileTimeZone(value);
      setProfileMessage(null);
      setProfileError(null);
      setIsTimeZoneModalOpen(false);
    },
    [setProfileTimeZone, setProfileMessage, setProfileError],
  );

  const displayName = profileName || user?.name || user?.email?.split('@')[0] || '—';
  const initials = getInitials(displayName);
  const avatarUrl = normalizeAvatarUrl(user?.avatarUrl);

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems="center"
            sx={{ textAlign: { xs: 'center', sm: 'left' } }}
          >
            <AvatarUploadButton
              avatarUrl={avatarUrl}
              displayName={displayName}
              initials={initials}
              showImage={!avatarError}
              disabled={avatarUploading}
              inputRef={avatarInputRef}
              onSelect={handleAvatarSelect}
              onImageError={() => setAvatarError(true)}
            />
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
                {displayName}
              </Typography>
              {user?.email ? (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
          {avatarMessage ? (
            <Alert variant="success" style={{ marginTop: 16 }}>
              {avatarMessage}
            </Alert>
          ) : null}
          {avatarErrorMessage ? (
            <Alert variant="error" style={{ marginTop: 16 }}>
              {avatarErrorMessage}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <ThemeSection
        t={t}
        tx={tx}
        appearanceMessage={appearanceMessage}
        appearanceError={appearanceError}
        appearanceLoading={appearanceLoading}
        themePreference={themePreference}
        handleThemePreferenceChange={handleThemePreferenceChange}
      />

      <SettingsAccordion
        id="profile"
        title={t.profileCard.title.value}
        icon={UserCircle}
        defaultExpanded={openSection === 'profile'}
      >
        <ProfileSection
          t={t}
          tx={tx}
          profileMessage={profileMessage}
          profileError={profileError}
          profileLoading={profileLoading}
          profileName={profileName}
          setProfileName={setProfileName}
          setProfileMessage={setProfileMessage}
          setProfileError={setProfileError}
          hasProfileChanges={hasProfileChanges}
          handleProfileSubmit={handleProfileSubmit}
          languageLabel={language.languageLabel}
          languageFieldLabel={resolveLabel(userMenu.language, 'Language')}
          isLanguageDrawerOpen={language.languageModalOpen}
          onOpenLanguageDrawer={language.openLanguageMenu}
          isTimeZoneModalOpen={isTimeZoneModalOpen}
          setIsTimeZoneModalOpen={setIsTimeZoneModalOpen}
          setTimeZoneSearch={setTimeZoneSearch}
          selectedTimeZoneOption={selectedTimeZoneOption}
          locale={locale}
          profileDateFormat={profileDateFormat}
          setProfileDateFormat={setProfileDateFormat}
          profileFirstDayOfWeek={profileFirstDayOfWeek}
          setProfileFirstDayOfWeek={setProfileFirstDayOfWeek}
        />
      </SettingsAccordion>

      <SettingsAccordion
        id="appearance"
        title={tx(['appearanceCard', 'detailsTitle'], 'Density & motion')}
        description={t.appearanceCard.description.value}
        icon={Palette}
        defaultExpanded={openSection === 'appearance'}
      >
        <AppearanceSection
          tx={tx}
          density={density}
          setDensity={setDensity}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
          showDailyQuote={showDailyQuote}
          setShowDailyQuote={setShowDailyQuote}
        />
      </SettingsAccordion>

      <LanguageDrawer
        isOpen={language.languageModalOpen}
        onClose={language.closeLanguageMenu}
        languageModal={languageModal}
        languageSearch={language.languageSearch}
        setLanguageSearch={language.setLanguageSearch}
        filteredLanguages={language.filteredLanguages}
        normalizedLocale={language.normalizedLocale}
        handleLanguageSelect={language.handleLanguageSelect as (code: string) => void}
      />

      <TimeZoneDrawer
        isOpen={isTimeZoneModalOpen}
        onClose={() => {
          setIsTimeZoneModalOpen(false);
          setTimeZoneSearch('');
        }}
        search={timeZoneSearch}
        onSearchChange={setTimeZoneSearch}
        options={filteredTimeZoneSelectOptions}
        selectedValue={selectedTimeZoneOption.value}
        onSelect={handleTimeZoneChange}
        labels={{
          title: t.profileCard.timeZoneLabel.value,
          placeholder: t.profileCard.timeZones.auto.value,
          help: t.profileCard.timeZoneHelp.value,
        }}
      />
    </Stack>
  );
}
