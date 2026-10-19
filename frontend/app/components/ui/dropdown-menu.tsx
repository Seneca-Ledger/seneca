/* eslint-disable max-lines */
'use client';

import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import RadioButton from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { Check } from '@/app/components/icons';

/* ─── Context ────────────────────────────────────────────────────────────── */

interface DropdownMenuCtx {
  anchorEl: HTMLElement | null;
  open: boolean;
  onOpen: (el: HTMLElement) => void;
  onClose: () => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuCtx>({
  anchorEl: null,
  open: false,
  onOpen: () => undefined,
  onClose: () => undefined,
});

/* ─── Radio group context ─────────────────────────────────────────────────── */

interface RadioGroupCtx {
  value: string;
  onValueChange: (v: string) => void;
}
const RadioGroupContext = React.createContext<RadioGroupCtx | null>(null);

/* ─── DropdownMenu ────────────────────────────────────────────────────────── */

interface DropdownMenuProps {
  children: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Controlled open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
}

function DropdownMenu({
  children,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
}: DropdownMenuProps): React.JSX.Element {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const onOpen = React.useCallback(
    (el: HTMLElement): void => {
      setAnchorEl(el);
      if (!isControlled) setInternalOpen(true);
      onOpenChange?.(true);
    },
    [isControlled, onOpenChange],
  );

  const onClose = React.useCallback((): void => {
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
  }, [isControlled, onOpenChange]);

  return (
    <DropdownMenuContext.Provider value={{ anchorEl, open, onOpen, onClose }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

/* ─── DropdownMenuTrigger ─────────────────────────────────────────────────── */

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  /** Render trigger inline without a wrapper element */
  asChild?: boolean;
  className?: string;
}

function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps): React.JSX.Element {
  const { onOpen, open } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent<HTMLElement>): void => {
    onOpen(e.currentTarget);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        const originalOnClick = (children.props as Record<string, unknown>).onClick;
        if (typeof originalOnClick === 'function') {
          originalOnClick(e);
        }
        handleClick(e);
      },
      'aria-expanded': open,
      'aria-haspopup': 'menu',
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {children}
    </button>
  );
}

/* ─── DropdownMenuContent ─────────────────────────────────────────────────── */

interface DropdownMenuContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CONTENT_PAPER_SX = { minWidth: 220, boxShadow: 3, p: 0.5 };

function resolveHorizontalOrigin(align: 'start' | 'center' | 'end'): 'left' | 'center' | 'right' {
  if (align === 'end') return 'right';
  if (align === 'center') return 'center';
  return 'left';
}

function DropdownMenuContent({
  children,
  align = 'start',
  className,
  style,
}: DropdownMenuContentProps): React.JSX.Element {
  const { anchorEl, open, onClose } = React.useContext(DropdownMenuContext);
  const horizontalOrigin = resolveHorizontalOrigin(align);
  const origin = { vertical: 'bottom' as const, horizontal: horizontalOrigin };
  const transformOrigin = { vertical: 'top' as const, horizontal: horizontalOrigin };
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      style={style}
      anchorOrigin={origin}
      transformOrigin={transformOrigin}
      slotProps={{ paper: { sx: CONTENT_PAPER_SX, className } }}
    >
      {children}
    </Menu>
  );
}

/* ─── DropdownMenuItem ────────────────────────────────────────────────────── */

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
}

const DropdownMenuItem = React.forwardRef<HTMLLIElement, DropdownMenuItemProps>(
  (
    { children, inset, disabled, onClick, onSelect, className, style, ...props },
    ref,
  ): React.JSX.Element => {
    const { onClose } = React.useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLLIElement>): void => {
      onClick?.(e);
      onSelect?.();
      onClose();
    };

    return (
      <MenuItem
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={className}
        style={{ paddingLeft: inset ? 32 : undefined, ...style }}
        {...(props as object)}
      >
        {children}
      </MenuItem>
    );
  },
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

/* ─── DropdownMenuCheckboxItem ─────────────────────────────────────────────── */

interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLLIElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const DropdownMenuCheckboxItem = React.forwardRef<HTMLLIElement, DropdownMenuCheckboxItemProps>(
  (
    { children, checked, onCheckedChange, disabled, className, ...props },
    ref,
  ): React.JSX.Element => (
    <MenuItem
      ref={ref}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={className}
      {...(props as object)}
    >
      <ListItemIcon>
        {checked ? (
          <Check size={16} />
        ) : (
          <span style={{ width: 16, height: 16, display: 'inline-block' }} />
        )}
      </ListItemIcon>
      {children}
    </MenuItem>
  ),
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

/* ─── DropdownMenuRadioGroup ─────────────────────────────────────────────── */

interface DropdownMenuRadioGroupProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

function DropdownMenuRadioGroup({
  children,
  value: valueProp,
  defaultValue = '',
  onValueChange,
}: DropdownMenuRadioGroupProps): React.JSX.Element {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = valueProp !== undefined ? valueProp : internalValue;

  const handleChange = React.useCallback(
    (v: string): void => {
      if (valueProp === undefined) setInternalValue(v);
      onValueChange?.(v);
    },
    [valueProp, onValueChange],
  );

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange: handleChange }}>
      {children}
    </RadioGroupContext.Provider>
  );
}

/* ─── DropdownMenuRadioItem ─────────────────────────────────────────────── */

interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLLIElement> {
  value: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

const DropdownMenuRadioItem = React.forwardRef<HTMLLIElement, DropdownMenuRadioItemProps>(
  // eslint-disable-next-line max-params
  ({ children, value, disabled, className, ...props }, ref): React.JSX.Element => {
    const radioCtx = React.useContext(RadioGroupContext);

    return (
      <MenuItem
        ref={ref}
        disabled={disabled}
        onClick={() => radioCtx?.onValueChange(value)}
        className={className}
        {...(props as object)}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <RadioButton
            checked={radioCtx?.value === value}
            size="small"
            sx={{ p: 0 }}
            onChange={() => radioCtx?.onValueChange(value)}
          />
        </ListItemIcon>
        <ListItemText primary={children} />
      </MenuItem>
    );
  },
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

/* ─── DropdownMenuLabel ─────────────────────────────────────────────────── */

interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  children?: React.ReactNode;
}

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  // eslint-disable-next-line max-params
  ({ children, inset, className, style, ...props }, ref): React.JSX.Element => (
    <div
      ref={ref}
      className={className}
      style={{ padding: '8px 12px', paddingLeft: inset ? 32 : 12, ...style }}
      {...props}
    >
      <Typography variant="body2" fontWeight={600}>
        {children}
      </Typography>
    </div>
  ),
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

/* ─── DropdownMenuSeparator ─────────────────────────────────────────────── */

interface DropdownMenuSeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  _unused?: never;
}

const DropdownMenuSeparator = React.forwardRef<HTMLHRElement, DropdownMenuSeparatorProps>(
  // eslint-disable-next-line max-params
  ({ className, ...props }, ref): React.JSX.Element => (
    <Divider ref={ref} className={className} {...(props as object)} />
  ),
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

/* ─── DropdownMenuShortcut ──────────────────────────────────────────────── */

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element => (
  <span
    style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}
    className={className}
    {...props}
  />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

/* ─── Sub-menu stubs (used only in stories) ─────────────────────────────── */

const DropdownMenuGroup = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <>{children}</>
);
const DropdownMenuPortal = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <>{children}</>
);
const DropdownMenuSub = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <>{children}</>
);

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLLIElement,
  DropdownMenuItemProps & { inset?: boolean }
>(
  // eslint-disable-next-line max-params
  ({ children, inset, className, ...props }, ref): React.JSX.Element => (
    <MenuItem
      ref={ref}
      className={className}
      style={{ paddingLeft: inset ? 32 : undefined }}
      {...(props as object)}
    >
      {children}
    </MenuItem>
  ),
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

interface DropdownMenuSubContentProps {
  children?: React.ReactNode;
  className?: string;
}

const DropdownMenuSubContent = ({
  children,
  className,
}: DropdownMenuSubContentProps): React.JSX.Element => <div className={className}>{children}</div>;

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
