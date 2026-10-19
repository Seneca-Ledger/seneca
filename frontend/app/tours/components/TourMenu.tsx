/**
 * Tour menu component
 */

'use client';

import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useCallback, useState } from 'react';
import { Circle, Disc } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getTourManager } from '../TourManager';
import type { TourConfig } from '../types';
import type { TourTextsMap } from './TourMenuHooks';
import { useTourCompletedState, useTourRegistration } from './TourMenuHooks';

interface TourMenuProps {
  trigger?: ReactNode;
  className?: string;
}

/** Narrow view of the 'navigation' intlayer dictionary used by the tour menu. */
interface TourNavigationTexts {
  tour: {
    buttons: { next: { value: string }; prev: { value: string }; done: { value: string } };
    progressText?: { value: string };
    menuLabel: { value: string };
  };
  shell: { toursNotFound: { value: string } };
}

function TourTrigger(props: {
  trigger?: ReactNode;
  className?: string;
  ariaLabel: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}): ReactElement {
  const { trigger, className, ariaLabel, onClick } = props;

  if (!trigger) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`h-9 w-9 rounded-full flex items-center justify-center shadow-sm ${className ?? ''} bg-primary text-white`}
      >
        <Disc size={16} />
      </button>
    );
  }

  if (isValidElement(trigger)) {
    return cloneElement(
      trigger as ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>,
      {
        onClick: (event: MouseEvent<HTMLElement>): void => {
          (trigger.props as { onClick?: (e: MouseEvent<HTMLElement>) => void })?.onClick?.(event);
          onClick(event);
        },
      },
    );
  }

  return (
    <button type="button" onClick={onClick}>
      {trigger as ReactNode}
    </button>
  );
}

function TourMenuItem(props: {
  tour: TourConfig;
  isCompleted: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const { tour, isCompleted, onSelect } = props;
  return (
    <MenuItem onClick={(): void => onSelect(tour.id)}>
      <ListItemIcon>
        {isCompleted ? (
          <Disc size={20} style={{ color: '#3b82f6' }} />
        ) : (
          <Circle size={20} style={{ color: 'var(--muted-foreground)' }} />
        )}
      </ListItemIcon>
      <ListItemText
        primary={tour.name}
        secondary={tour.description}
        primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
        secondaryTypographyProps={{ fontSize: 12, noWrap: true }}
      />
    </MenuItem>
  );
}

function useTourMenuTexts(): { statementsTexts: unknown; tourTexts: TourTextsMap } {
  const statementsTexts = useIntlayer('statements-tour');
  const tourTexts: TourTextsMap = {
    customTables: useIntlayer('custom-tables-tour-content'),
    reports: useIntlayer('reports-tour-content'),
    categories: useIntlayer('categories-tour-content'),
    integrations: useIntlayer('integrations-tour-content'),
    settings: useIntlayer('settings-tour-content'),
    admin: useIntlayer('admin-tour-content'),
  };
  return { statementsTexts, tourTexts };
}

function useTourSelectHandler(
  tours: TourConfig[],
  handleClose: () => void,
  navigationTexts: TourNavigationTexts,
): (tourId: string) => void {
  const router = useRouter();
  return useCallback(
    (tourId: string): void => {
      const tourManager = getTourManager();
      const tour = tours.find(t => t.id === tourId);
      handleClose();
      if (tourManager.isTourCompleted(tourId)) {
        tourManager.resetTour(tourId);
      }
      void (async (): Promise<void> => {
        if (tour?.page && !window.location.pathname.startsWith(tour.page)) {
          router.push(tour.page);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        void tourManager.startTour(tourId, 0, {
          nextBtnText: navigationTexts.tour.buttons.next.value,
          prevBtnText: navigationTexts.tour.buttons.prev.value,
          doneBtnText: navigationTexts.tour.buttons.done.value,
          progressText: navigationTexts.tour.progressText?.value ?? '{{current}} / {{total}}',
        });
      })();
    },
    [tours, handleClose, router, navigationTexts],
  );
}

export function TourMenu({ trigger, className = '' }: TourMenuProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const navigationTexts = useIntlayer('navigation') as unknown as TourNavigationTexts;
  const { statementsTexts, tourTexts } = useTourMenuTexts();

  useTourRegistration({ statementsTexts, tourTexts });
  const { tours, completedTours } = useTourCompletedState(open);

  const handleClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);
  const handleClick = useCallback((event: MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleTourSelect = useTourSelectHandler(tours, handleClose, navigationTexts);

  return (
    <>
      <TourTrigger
        trigger={trigger}
        className={className}
        ariaLabel={navigationTexts.tour.menuLabel.value}
        onClick={handleClick}
      />
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 250, mt: 1 } }}
      >
        {tours.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary={navigationTexts.shell.toursNotFound.value} />
          </MenuItem>
        )}
        {tours.map((tour, index) => (
          <div key={tour.id}>
            {index > 0 && index % 3 === 0 && <Divider />}
            <TourMenuItem
              tour={tour}
              isCompleted={completedTours.has(tour.id)}
              onSelect={handleTourSelect}
            />
          </div>
        ))}
      </Menu>
    </>
  );
}
