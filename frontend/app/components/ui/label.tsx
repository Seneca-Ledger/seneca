'use client';

import Typography from '@mui/material/Typography';
import * as React from 'react';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, style, children, ...props }, ref) => (
    <Typography
      component="label"
      variant="body2"
      ref={ref as React.Ref<HTMLLabelElement>}
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
Label.displayName = 'Label';

export { Label };
