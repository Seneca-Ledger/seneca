/**
 * Tour trigger button component
 */

'use client';

import { Button } from '@mui/material';
import { PlayCircle } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { useTour } from '../../hooks/useTour';

interface TourButtonProps {
  tourId: string;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// Hoisted: a JSX default parameter keeps React Compiler from compiling the component.
const DEFAULT_ICON = <PlayCircle size={16} />;

export function TourButton({
  tourId,
  variant = 'outlined',
  size = 'small',
  label,
  icon = DEFAULT_ICON,
  disabled = false,
  className = '',
}: TourButtonProps) {
  const { startTour, isActive, isCompleted } = useTour(tourId);
  const t = useIntlayer('tourControls');

  const handleClick = () => {
    if (!isActive) {
      startTour();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isActive}
      startIcon={icon}
      className={className}
      sx={{
        textTransform: 'none',
        fontWeight: 500,
      }}
    >
      {isCompleted ? t.repeatTour : (label ?? t.showTour)}
    </Button>
  );
}
