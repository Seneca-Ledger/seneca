'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useId, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer } from '@/app/i18n';
import { api } from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { AVAILABLE_BACKGROUNDS } from '../constants';
import { BackgroundSelector } from './BackgroundSelector';
import { CurrencySelector } from './CurrencySelector';
import { ServiceIntegrationSuggestions } from './ServiceIntegrationSuggestions';

type ApiErrorLike = { response?: { data?: { message?: string } } };

const getApiMessage = ({ error, fallback }: { error: unknown; fallback: string }): string => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }
  return (error as ApiErrorLike).response?.data?.message || fallback;
};

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function useWorkspaceFormState(): {
  step: number;
  name: string;
  description: string;
  profile: WorkspaceProfile;
  selectedBackground: string | null;
  selectedCurrency: string | null;
  loading: boolean;
  createdWorkspaceId: string | null;
  currencyDrawerOpen: boolean;
  setStep: (v: number) => void;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setProfile: (v: WorkspaceProfile) => void;
  setSelectedBackground: (v: string | null) => void;
  setSelectedCurrency: (v: string | null) => void;
  setLoading: (v: boolean) => void;
  setCreatedWorkspaceId: (v: string | null) => void;
  setCurrencyDrawerOpen: (v: boolean) => void;
  reset: () => void;
} {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Business is how every workspace behaved before the profile existed.
  const [profile, setProfile] = useState<WorkspaceProfile>('business');
  const [selectedBackground, setSelectedBackground] = useState<string | null>(
    AVAILABLE_BACKGROUNDS[0],
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const reset = (): void => {
    setStep(1);
    setName('');
    setDescription('');
    setProfile('business');
    setSelectedBackground(AVAILABLE_BACKGROUNDS[0]);
    setSelectedCurrency(null);
    setCreatedWorkspaceId(null);
    setCurrencyDrawerOpen(false);
  };
  return {
    step,
    name,
    description,
    profile,
    selectedBackground,
    selectedCurrency,
    loading,
    createdWorkspaceId,
    currencyDrawerOpen,
    setStep,
    setName,
    setDescription,
    setProfile,
    setSelectedBackground,
    setSelectedCurrency,
    setLoading,
    setCreatedWorkspaceId,
    setCurrencyDrawerOpen,
    reset,
  };
}

function StepBadges({ step }: { step: number }): React.JSX.Element {
  const items = [
    { id: 1, label: 'Basic Info' },
    { id: 2, label: 'Customization' },
    { id: 3, label: 'Integrations' },
  ];
  return (
    <nav aria-label="Workspace setup steps" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <Box
          key={item.id}
          sx={{
            border: item.id === step ? '1px solid var(--primary)' : '1px solid var(--border-color)',
            px: 1.5,
            py: 0.5,
            fontSize: 12,
            fontWeight: 600,
            color: item.id === step ? 'var(--primary)' : 'var(--muted-foreground)',
            bgcolor: item.id === step ? 'rgba(var(--primary-rgb,22,129,24),0.1)' : 'transparent',
          }}
          aria-current={item.id === step ? 'step' : undefined}
        >
          {item.label}
        </Box>
      ))}
    </nav>
  );
}

function StepIndicator({ step }: { step: number }): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
      }}
    >
      <Typography variant="body2" style={{ color: 'var(--muted-foreground)' }}>
        Step {step} of 3
      </Typography>
      <StepBadges step={step} />
    </Box>
  );
}

type Step1Props = {
  name: string;
  description: string;
  profile: WorkspaceProfile;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onProfileChange: (v: WorkspaceProfile) => void;
};
function Step1Content({
  name,
  description,
  profile,
  onNameChange,
  onDescriptionChange,
  onProfileChange,
}: Step1Props): React.JSX.Element {
  const t = useIntlayer('createWorkspaceModal');
  return (
    <Stack spacing={3}>
      {/* Home hides the business pages from the menu; nothing else changes. */}
      <Stack spacing={1}>
        <Typography variant="body2" fontWeight={600} id="workspace-profile-label">
          {t.profileLabel}
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={profile}
          onChange={(_event, value: WorkspaceProfile | null) => value && onProfileChange(value)}
          aria-labelledby="workspace-profile-label"
        >
          <ToggleButton value="home" sx={{ textTransform: 'none', flexDirection: 'column' }}>
            <Typography variant="body2" fontWeight={600}>
              {t.profileHome}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t.profileHomeHint}
            </Typography>
          </ToggleButton>
          <ToggleButton value="business" sx={{ textTransform: 'none', flexDirection: 'column' }}>
            <Typography variant="body2" fontWeight={600}>
              {t.profileBusiness}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t.profileBusinessHint}
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <TextField
        label="Workspace Name"
        required
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="My Workspace"
        inputProps={{ maxLength: 255 }}
        fullWidth
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="What is this workspace for?"
        inputProps={{ maxLength: 500 }}
        multiline
        minRows={4}
        fullWidth
      />
    </Stack>
  );
}

type Step2Props = {
  selectedCurrency: string | null;
  selectedBackground: string | null;
  onSelectCurrency: (v: string | null) => void;
  onSelectBackground: (v: string | null) => void;
  onOpenCurrencyDrawer: () => void;
};
function Step2Content({
  selectedCurrency,
  selectedBackground,
  onSelectCurrency,
  onSelectBackground,
  onOpenCurrencyDrawer,
}: Step2Props): React.JSX.Element {
  return (
    <Stack spacing={4}>
      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onSelect={onSelectCurrency}
        mode="inline"
        open={false}
        onOpenChange={(nextOpen: boolean) => {
          if (nextOpen) {
            onOpenCurrencyDrawer();
          }
        }}
      />
      <Box>
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1.5, color: 'var(--foreground)' }}>
          Background Image
        </Typography>
        <BackgroundSelector
          selectedBackground={selectedBackground}
          onSelect={onSelectBackground}
          backgrounds={AVAILABLE_BACKGROUNDS}
        />
      </Box>
    </Stack>
  );
}

type ActionsProps = {
  step: number;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onFinishStep2: () => void;
  onProceedToStep3: () => void;
};
function Step1Actions({ onNext }: { onNext: () => void }): React.JSX.Element {
  return (
    <Button type="button" variant="contained" onClick={onNext} endIcon={<ChevronRight size={16} />}>
      Next
    </Button>
  );
}

function Step2Actions({
  loading,
  onFinishStep2,
  onProceedToStep3,
}: {
  loading: boolean;
  onFinishStep2: () => void;
  onProceedToStep3: () => void;
}): React.JSX.Element {
  return (
    <>
      <Button type="button" variant="outlined" onClick={onFinishStep2} disabled={loading}>
        {loading ? 'Creating...' : 'Skip Integrations'}
      </Button>
      <Button
        type="button"
        variant="contained"
        onClick={onProceedToStep3}
        disabled={loading}
        endIcon={!loading ? <ChevronRight size={16} /> : undefined}
      >
        {loading ? 'Creating...' : 'Next'}
      </Button>
    </>
  );
}

function ModalActions({
  step,
  loading,
  onBack,
  onNext,
  onFinishStep2,
  onProceedToStep3,
}: ActionsProps): React.JSX.Element {
  return (
    <DialogActions sx={{ px: 4, py: 3, justifyContent: 'space-between' }}>
      <Box>
        {step > 1 && (
          <Button
            type="button"
            variant="outlined"
            onClick={onBack}
            startIcon={<ChevronLeft size={16} />}
          >
            Back
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {step === 1 && <Step1Actions onNext={onNext} />}
        {step === 2 && (
          <Step2Actions
            loading={loading}
            onFinishStep2={onFinishStep2}
            onProceedToStep3={onProceedToStep3}
          />
        )}
      </Box>
    </DialogActions>
  );
}

type CurrencyDrawerProps = {
  isOpen: boolean;
  selectedCurrency: string | null;
  onClose: () => void;
  onSelect: (v: string | null) => void;
};
function WorkspaceCurrencyDrawer({
  isOpen,
  selectedCurrency,
  onClose,
  onSelect,
}: CurrencyDrawerProps): React.JSX.Element {
  const picker = useCurrencyPickerState(selectedCurrency ?? '');
  const handleClose = (): void => {
    picker.setCurrencySearch('');
    onClose();
  };
  return (
    <CurrencyDrawer
      isOpen={isOpen}
      onClose={handleClose}
      currencySearch={picker.currencySearch}
      setCurrencySearch={picker.setCurrencySearch}
      selectedCurrencyItem={picker.selectedCurrencyItem}
      selectedMatchesSearch={picker.selectedMatchesSearch}
      currencyQuery={picker.currencyQuery}
      recentCurrencyItems={picker.recentCurrencyItems}
      allCurrencyItems={picker.allCurrencyItems}
      handleSelectCurrency={code => {
        onSelect(code);
        picker.pushRecentCurrency(code);
        onClose();
      }}
      zIndex={1400}
    />
  );
}

type CreationHookParams = {
  name: string;
  description: string;
  profile: WorkspaceProfile;
  selectedBackground: string | null;
  selectedCurrency: string | null;
  setLoading: (v: boolean) => void;
  setCreatedWorkspaceId: (v: string | null) => void;
};
function useWorkspaceCreation({
  name,
  description,
  profile,
  selectedBackground,
  selectedCurrency,
  setLoading,
  setCreatedWorkspaceId,
}: CreationHookParams): { createWorkspace: () => Promise<string | undefined> } {
  const createWorkspace = async (): Promise<string | undefined> => {
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return undefined;
    }
    setLoading(true);
    try {
      // Nothing picked is "no value": the API takes absent fields, not nulls.
      const payload: ContractInput<'CreateWorkspaceBody'> = {
        name: name.trim(),
        description: description.trim() || undefined,
        backgroundImage: selectedBackground ?? undefined,
        currency: selectedCurrency ?? undefined,
        profile,
      };
      const response = await api.post('/workspaces', payload);
      setCreatedWorkspaceId(response.data.id);
      toast.success('Workspace created successfully');
      return response.data.id as string;
    } catch (error: unknown) {
      toast.error(getApiMessage({ error, fallback: 'Failed to create workspace' }));
      throw error;
    } finally {
      setLoading(false);
    }
  };
  return { createWorkspace };
}

type StepContentProps = {
  step: number;
  name: string;
  description: string;
  profile: WorkspaceProfile;
  selectedCurrency: string | null;
  selectedBackground: string | null;
  createdWorkspaceId: string | null;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onProfileChange: (v: WorkspaceProfile) => void;
  onSelectCurrency: (v: string | null) => void;
  onSelectBackground: (v: string | null) => void;
  onOpenCurrencyDrawer: () => void;
  onSkip: () => void;
};
function StepContent({
  step,
  name,
  description,
  profile,
  selectedCurrency,
  selectedBackground,
  createdWorkspaceId,
  onNameChange,
  onDescriptionChange,
  onProfileChange,
  onSelectCurrency,
  onSelectBackground,
  onOpenCurrencyDrawer,
  onSkip,
}: StepContentProps): React.JSX.Element {
  if (step === 1) {
    return (
      <Step1Content
        name={name}
        description={description}
        profile={profile}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onProfileChange={onProfileChange}
      />
    );
  }
  if (step === 2) {
    return (
      <Step2Content
        selectedCurrency={selectedCurrency}
        selectedBackground={selectedBackground}
        onSelectCurrency={onSelectCurrency}
        onSelectBackground={onSelectBackground}
        onOpenCurrencyDrawer={onOpenCurrencyDrawer}
      />
    );
  }
  return <ServiceIntegrationSuggestions workspaceId={createdWorkspaceId ?? ''} onSkip={onSkip} />;
}

function useModalHandlers({
  s,
  switchWorkspace,
  refreshWorkspaces,
  onSuccess,
  onClose,
  createWorkspace,
}: {
  s: ReturnType<typeof useWorkspaceFormState>;
  switchWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  onSuccess: () => void;
  onClose: () => void;
  createWorkspace: () => Promise<string | undefined>;
}): {
  finalize: () => Promise<void>;
  handleNext: () => void;
  handleProceedToStep3: () => Promise<void>;
} {
  const finalize = async (): Promise<void> => {
    const id = await createWorkspace().catch(() => undefined);
    if (!id) {
      return;
    }
    await switchWorkspace(id);
    await refreshWorkspaces();
    s.reset();
    onSuccess();
    onClose();
  };
  const handleNext = (): void => {
    if (s.step === 1 && !s.name.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    s.setStep(s.step + 1);
  };
  const handleProceedToStep3 = async (): Promise<void> => {
    const id = await createWorkspace().catch(() => undefined);
    if (id) {
      s.setStep(3);
    }
  };
  return { finalize, handleNext, handleProceedToStep3 };
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateWorkspaceModalProps): React.JSX.Element {
  const { switchWorkspace, refreshWorkspaces } = useWorkspace();
  const dialogTitleId = useId();
  const s = useWorkspaceFormState();
  const { createWorkspace } = useWorkspaceCreation({
    name: s.name,
    description: s.description,
    profile: s.profile,
    selectedBackground: s.selectedBackground,
    selectedCurrency: s.selectedCurrency,
    setLoading: s.setLoading,
    setCreatedWorkspaceId: s.setCreatedWorkspaceId,
  });
  const { finalize, handleNext, handleProceedToStep3 } = useModalHandlers({
    s,
    switchWorkspace,
    refreshWorkspaces,
    onSuccess,
    onClose,
    createWorkspace,
  });
  return (
    <>
      <Dialog
        open={isOpen}
        onClose={() => {
          s.reset();
          onClose();
        }}
        maxWidth="lg"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ px: 4, pt: 3, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--primary)',
              }}
            >
              Workspace setup
            </Typography>
            <Box>
              <Typography
                id={dialogTitleId}
                variant="h5"
                fontWeight={600}
                style={{ color: 'var(--foreground)' }}
              >
                Create New Workspace
              </Typography>
              <Typography variant="body2" style={{ color: 'var(--muted-foreground)' }}>
                Create a dedicated space for your documents, receipts, and reports.
              </Typography>
            </Box>
            <StepIndicator step={s.step} />
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 4, py: 4 }}>
          <StepContent
            step={s.step}
            name={s.name}
            description={s.description}
            profile={s.profile}
            selectedCurrency={s.selectedCurrency}
            selectedBackground={s.selectedBackground}
            createdWorkspaceId={s.createdWorkspaceId}
            onNameChange={s.setName}
            onDescriptionChange={s.setDescription}
            onProfileChange={s.setProfile}
            onSelectCurrency={s.setSelectedCurrency}
            onSelectBackground={s.setSelectedBackground}
            onOpenCurrencyDrawer={() => s.setCurrencyDrawerOpen(true)}
            onSkip={finalize}
          />
        </DialogContent>
        <ModalActions
          step={s.step}
          loading={s.loading}
          onBack={() => s.setStep(s.step - 1)}
          onNext={handleNext}
          onFinishStep2={finalize}
          onProceedToStep3={() => {
            void handleProceedToStep3();
          }}
        />
      </Dialog>
      <WorkspaceCurrencyDrawer
        isOpen={isOpen && s.step === 2 && s.currencyDrawerOpen}
        selectedCurrency={s.selectedCurrency}
        onClose={() => s.setCurrencyDrawerOpen(false)}
        onSelect={s.setSelectedCurrency}
      />
    </>
  );
}
