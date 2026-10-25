import { useState } from 'react';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { AVAILABLE_BACKGROUNDS } from '../../constants';

/** Form state of the create-workspace wizard, with a reset back to its defaults. */
export function useWorkspaceFormState(): {
  step: number;
  name: string;
  description: string;
  profile: WorkspaceProfile;
  selectedBackground: string | null;
  selectedCurrency: string | null;
  loading: boolean;
  currencyDrawerOpen: boolean;
  setStep: (v: number) => void;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setProfile: (v: WorkspaceProfile) => void;
  setSelectedBackground: (v: string | null) => void;
  setSelectedCurrency: (v: string | null) => void;
  setLoading: (v: boolean) => void;
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
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const reset = (): void => {
    setStep(1);
    setName('');
    setDescription('');
    setProfile('business');
    setSelectedBackground(AVAILABLE_BACKGROUNDS[0]);
    setSelectedCurrency(null);
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
    currencyDrawerOpen,
    setStep,
    setName,
    setDescription,
    setProfile,
    setSelectedBackground,
    setSelectedCurrency,
    setLoading,
    setCurrencyDrawerOpen,
    reset,
  };
}
