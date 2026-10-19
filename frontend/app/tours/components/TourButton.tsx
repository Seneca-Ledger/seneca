/**
 * Tour trigger button component
 */

'use client';

import { Button } from '@mui/material';
import { PlayCircle } from '@/app/components/icons';
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
  label = 'Show tour',
  icon = DEFAULT_ICON,
  disabled = false,
  className = '',
}: TourButtonProps) {
  const { startTour, isActive, isCompleted } = useTour(tourId);

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
      {isCompleted ? 'Repeat tour' : label}
    </Button>
  );
}
