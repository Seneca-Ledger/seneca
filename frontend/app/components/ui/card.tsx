'use client';

import MuiCard from '@mui/material/Card';
import MuiCardActions from '@mui/material/CardActions';
import MuiCardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import * as React from 'react';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, children, ...props }, ref) => (
    <MuiCard
      ref={ref}
      className={className}
      style={style}
      variant="outlined"
      {...(props as object)}
    >
      {children}
    </MuiCard>
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, children, ...props }, ref) => (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, style, children, ...props }, ref) => (
    <Typography
      component="h3"
      variant="subtitle1"
      ref={ref as React.Ref<HTMLHeadingElement>}
      className={className}
      style={style}
      {...(props as object)}
      sx={{
        fontWeight: 600,
      }}
    >
      {children}
    </Typography>
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, style, children, ...props }, ref) => (
  <Typography
    component="p"
    variant="body2"
    ref={ref as React.Ref<HTMLParagraphElement>}
    className={className}
    style={style}
    {...(props as object)}
    sx={{
      color: 'text.secondary',
    }}
  >
    {children}
  </Typography>
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, children, ...props }, ref) => (
    <MuiCardContent ref={ref} className={className} style={style} {...(props as object)}>
      {children}
    </MuiCardContent>
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, children, ...props }, ref) => (
    <MuiCardActions ref={ref} className={className} style={style} {...(props as object)}>
      {children}
    </MuiCardActions>
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
