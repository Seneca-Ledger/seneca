'use client';

import MuiAlert, { type AlertProps as MuiAlertProps } from '@mui/material/Alert';
import MuiAlertTitle from '@mui/material/AlertTitle';
import * as React from 'react';

export type AlertVariant = 'default' | 'success' | 'error' | 'warning' | 'destructive';

const variantToSeverity = (variant: AlertVariant): MuiAlertProps['severity'] => {
  switch (variant) {
    case 'success':
      return 'success';
    case 'error':
    case 'destructive':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }
>(({ className, style, variant = 'default', children, ...props }, ref) => (
  <MuiAlert
    ref={ref}
    severity={variantToSeverity(variant)}
    className={className}
    style={style}
    {...(props as object)}
  >
    {children}
  </MuiAlert>
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, style, children, ...props }, ref) => (
    <MuiAlertTitle ref={ref} className={className} style={style} {...(props as object)}>
      {children}
    </MuiAlertTitle>
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, style, children, ...props }, ref) => (
  <div ref={ref} className={className} style={style} {...props}>
    {children}
  </div>
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle };
