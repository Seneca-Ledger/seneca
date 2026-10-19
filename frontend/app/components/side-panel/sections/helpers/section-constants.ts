import React from 'react';
import { AlertCircle, AlertTriangle, Info } from '@/app/components/icons';

export const STATUS_COLOR_MAP: Record<string, string> = {
  online: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  offline: '#9ca3af',
};

export const ACTION_VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: { backgroundColor: 'var(--primary)', color: 'white', border: 'none' },
  secondary: { backgroundColor: '#f3f4f6', color: '#374151', border: 'none' },
  destructive: { backgroundColor: '#fee2e2', color: '#dc2626', border: 'none' },
  outline: { backgroundColor: 'transparent', color: '#374151', border: '1px solid #e5e7eb' },
  ghost: { backgroundColor: 'transparent', color: '#374151', border: 'none' },
};

export const ACTION_SIZE_STYLES: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 10px', fontSize: 12 },
  md: { padding: '8px 12px', fontSize: 14 },
  lg: { padding: '10px 16px', fontSize: 16 },
};

export const ERROR_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: AlertCircle,
};

export const ERROR_BG: Record<string, string> = {
  info: '#eff6ff',
  warning: '#fffbeb',
  error: '#fef2f2',
  critical: '#fee2e2',
};

export const ERROR_BORDER: Record<string, string> = {
  info: '#bfdbfe',
  warning: '#fde68a',
  error: '#fecaca',
  critical: '#fca5a5',
};

export const ERROR_ICON_COLOR: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
  critical: '#dc2626',
};
