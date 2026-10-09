'use client';

import { Alert, Box, Button, CircularProgress, Stack, TextField } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import {
  type BusinessProfile,
  type BusinessProfileInput,
  businessLogoUrl,
  businessProfileApi,
} from '@/app/lib/business-profile-api';
import { tokens } from '@/lib/theme-tokens';
import { SettingsSection } from './SettingsSection';

/** Every editable field, in the order the document prints them. */
const FIELDS = [
  ['legalName'],
  ['addressLines'],
  ['countryCode'],
  ['registrationId'],
  ['taxId'],
  ['email'],
  ['phone'],
  ['website'],
  ['bankName'],
  ['bankAccount'],
  ['bankCode'],
  ['paymentInstructions'],
  ['invoiceFooter'],
] as const satisfies ReadonlyArray<readonly [keyof BusinessProfileInput]>;

const MULTILINE = new Set<string>(['addressLines', 'paymentInstructions', 'invoiceFooter']);

type Draft = Record<keyof BusinessProfileInput, string>;

const toDraft = (profile: BusinessProfile): Draft =>
  Object.fromEntries(FIELDS.map(([field]) => [field, profile[field] ?? ''])) as Draft;

/**
 * Who the workspace is, as a business.
 *
 * Lives next to the tax sections because it is the same kind of setting: the
 * identity every document the workspace issues carries. An invoice cannot be
 * sent until the name and address are here, so the section says which fields
 * are still missing rather than leaving the refusal to the send button.
 */
export function BusinessProfileSection(): React.ReactElement {
  const t = useIntlayer('businessProfile');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Read one by one rather than indexed: the dictionary's type is a union, so
  // a dynamic lookup on it collapses to `never`.
  const label: Record<keyof BusinessProfileInput, string> = {
    legalName: String(t.legalName.value),
    addressLines: String(t.addressLines.value),
    countryCode: String(t.countryCode.value),
    registrationId: String(t.registrationId.value),
    taxId: String(t.taxId.value),
    email: String(t.email.value),
    phone: String(t.phone.value),
    website: String(t.website.value),
    bankName: String(t.bankName.value),
    bankAccount: String(t.bankAccount.value),
    bankCode: String(t.bankCode.value),
    paymentInstructions: String(t.paymentInstructions.value),
    invoiceFooter: String(t.invoiceFooter.value),
  };

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<'load' | 'save' | null>(null);

  const apply = useCallback((profile: BusinessProfile) => {
    setDraft(toDraft(profile));
    setLogoFile(profile.logoFile);
    setMissing(profile.missingRequired ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    businessProfileApi
      .get()
      .then(profile => {
        if (!cancelled) {
          apply(profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed('load');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const handleSave = useCallback(async () => {
    if (!draft) {
      return;
    }
    setSaving(true);
    setFailed(null);
    setSaved(false);
    try {
      apply(await businessProfileApi.update(draft));
      setSaved(true);
    } catch {
      setFailed('save');
    } finally {
      setSaving(false);
    }
  }, [draft, apply]);

  const handleLogo = useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setFailed(null);
    try {
      const { logoFile: stored } = await businessProfileApi.uploadLogo(file);
      setLogoFile(stored);
    } catch {
      setFailed('save');
    }
  }, []);

  const handleRemoveLogo = useCallback(async () => {
    try {
      await businessProfileApi.removeLogo();
      setLogoFile(null);
    } catch {
      setFailed('save');
    }
  }, []);

  const logoSrc = businessLogoUrl(logoFile);

  return (
    <SettingsSection title={t.title} description={t.description}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={2}>
          {failed === 'load' ? <Alert severity="error">{t.loadError}</Alert> : null}
          {failed === 'save' ? <Alert severity="error">{t.saveError}</Alert> : null}
          {missing.length > 0 ? (
            <Alert severity="warning">
              {String(t.requiredHint.value).replace(
                '{fields}',
                missing
                  .map(field => label[field as keyof BusinessProfileInput] ?? field)
                  .join(', '),
              )}
            </Alert>
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {FIELDS.map(([field]) => (
              <TextField
                key={field}
                label={label[field]}
                value={draft?.[field] ?? ''}
                onChange={event =>
                  setDraft(previous =>
                    previous ? { ...previous, [field]: event.target.value } : previous,
                  )
                }
                size="small"
                multiline={MULTILINE.has(field)}
                minRows={MULTILINE.has(field) ? 2 : undefined}
                sx={{ gridColumn: MULTILINE.has(field) ? { sm: 'span 2' } : undefined }}
              />
            ))}
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            {logoSrc ? (
              // Plain <img>: the logo route is public by design, since an img
              // tag sends neither the auth cookie's workspace header nor a body.
              <Box
                component="img"
                src={logoSrc}
                alt={String(t.logo.value)}
                sx={{
                  height: 48,
                  maxWidth: 160,
                  objectFit: 'contain',
                  borderRadius: tokens.radius.sm,
                }}
              />
            ) : null}
            <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
              {t.uploadLogo}
            </Button>
            {logoFile ? (
              <Button size="small" color="inherit" onClick={() => void handleRemoveLogo()}>
                {t.removeLogo}
              </Button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={event => {
                void handleLogo(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
              {saving ? t.saving : t.save}
            </Button>
            {saved ? <Alert severity="success">{t.saved}</Alert> : null}
          </Stack>
        </Stack>
      )}
    </SettingsSection>
  );
}
