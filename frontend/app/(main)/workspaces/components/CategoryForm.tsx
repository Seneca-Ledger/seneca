'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { alpha, useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useRef } from 'react';
import { Check, Tag } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { Category, CategoryFormData } from './hooks/useCategoryManagement';

export const PREDEFINED_ICONS = [
  'mdi:home',
  'mdi:food',
  'mdi:car',
  'mdi:shopping',
  'mdi:cart',
  'mdi:medical-bag',
  'mdi:school',
  'mdi:briefcase',
  'mdi:airplane',
  'mdi:gift',
  'mdi:gamepad-variant',
  'mdi:dumbbell',
  'mdi:bank',
  'mdi:cash',
  'mdi:chart-line',
  'mdi:credit-card',
  'mdi:shield-check',
  'mdi:cog',
  'mdi:wrench',
  'mdi:tag',
  'mdi:coffee',
  'mdi:monitor',
  'mdi:phone',
  'mdi:music',
  'mdi:camera',
  'mdi:book',
  'mdi:heart',
  'mdi:star',
  'mdi:flag',
  'mdi:bell',
];

export const PREDEFINED_COLORS = [
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#03A9F4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#CDDC39',
  '#FFEB3B',
  '#FFC107',
  '#FF9800',
  '#FF5722',
  '#795548',
  '#9E9E9E',
  '#607D8B',
];

export const resolveIconUrl = (iconValue?: string): string | null => {
  if (!iconValue) {
    return null;
  }
  if (iconValue.startsWith('http')) {
    return iconValue;
  }
  if (iconValue.startsWith('/uploads')) {
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1$/, '');
    return `${base}${iconValue}`;
  }
  return null;
};

export type CategoryFormLabels = {
  editTitle: string;
  createTitle: string;
  nameLabel: string;
  placeholderName: string;
  typeLabel: string;
  typeIncome: string;
  typeExpense: string;
  chooseIcon: string;
  withoutIcon: string;
  uploadedIcon: string;
  uploading: string;
  uploadIcon: string;
  chooseColor: string;
  preview: string;
  cancel: string;
  save: string;
};

type CategoryFormProps = {
  open: boolean;
  editingCategory: Category | null;
  formData: CategoryFormData;
  uploadingIcon: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onFormDataChange: (data: CategoryFormData) => void;
  onIconFileChange: (file: File) => Promise<void>;
  labels: CategoryFormLabels;
};

type IconGridProps = {
  formData: CategoryFormData;
  onFormDataChange: (data: CategoryFormData) => void;
};
function IconGrid({ formData, onFormDataChange }: IconGridProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
        gap: 1,
        maxHeight: 200,
        overflowY: 'auto',
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.lg,
      }}
    >
      {PREDEFINED_ICONS.map(iconName => (
        <Box
          key={iconName}
          onClick={() => onFormDataChange({ ...formData, icon: iconName, withoutIcon: false })}
          sx={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.sm,
            cursor: 'pointer',
            bgcolor: formData.icon === iconName ? alpha(formData.color, 0.2) : 'transparent',
            color: formData.icon === iconName ? formData.color : 'text.secondary',
            border:
              formData.icon === iconName ? `2px solid ${formData.color}` : '1px solid transparent',
            '&:hover': {
              bgcolor: alpha(formData.color || theme.palette.primary.main, 0.1),
              color: formData.color || theme.palette.primary.main,
            },
          }}
        >
          <Tag size={24} />
        </Box>
      ))}
    </Box>
  );
}

type UploadRowProps = {
  formData: CategoryFormData;
  uploadingIcon: boolean;
  uploadLabel: string;
  uploadingLabel: string;
  uploadedIconLabel: string;
  onUploadClick: () => void;
};
function IconUploadRow({
  formData,
  uploadingIcon,
  uploadLabel,
  uploadingLabel,
  uploadedIconLabel,
  onUploadClick,
}: UploadRowProps): React.JSX.Element {
  const previewIconUrl = resolveIconUrl(formData.icon);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mt: 1.5,
        gap: 2,
      }}
    >
      {!formData.withoutIcon && previewIconUrl && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {uploadedIconLabel}
          </Typography>
          <Box
            component="img"
            src={previewIconUrl}
            alt=""
            sx={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.sm,
              objectFit: 'contain',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        </Box>
      )}
      <Button
        variant="outlined"
        size="small"
        onClick={onUploadClick}
        disabled={uploadingIcon}
        sx={{ ml: 'auto' }}
      >
        {uploadingIcon ? uploadingLabel : uploadLabel}
      </Button>
    </Box>
  );
}

type IconPickerProps = {
  formData: CategoryFormData;
  uploadingIcon: boolean;
  labels: CategoryFormLabels;
  onFormDataChange: (data: CategoryFormData) => void;
  onIconFileChange: (file: File) => Promise<void>;
};
function IconPicker({
  formData,
  uploadingIcon,
  labels,
  onFormDataChange,
  onIconFileChange,
}: IconPickerProps): React.JSX.Element {
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    await onIconFileChange(file);
    if (iconInputRef.current) {
      iconInputRef.current.value = '';
    }
  };
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {labels.chooseIcon}
      </Typography>
      <input
        type="file"
        accept="image/*"
        ref={iconInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <IconGrid formData={formData} onFormDataChange={onFormDataChange} />
      <Box sx={{ mt: 1.5 }}>
        <label
          style={{
            display: 'inline-flex',
            cursor: 'pointer',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: 'var(--foreground)',
          }}
        >
          <input
            type="checkbox"
            checked={formData.withoutIcon}
            onChange={e => onFormDataChange({ ...formData, withoutIcon: e.target.checked })}
          />
          {labels.withoutIcon}
        </label>
      </Box>
      <IconUploadRow
        formData={formData}
        uploadingIcon={uploadingIcon}
        uploadLabel={labels.uploadIcon}
        uploadingLabel={labels.uploading}
        uploadedIconLabel={labels.uploadedIcon}
        onUploadClick={() => iconInputRef.current?.click()}
      />
    </Box>
  );
}

type ColorPickerProps = {
  formData: CategoryFormData;
  label: string;
  onFormDataChange: (data: CategoryFormData) => void;
};
function ColorPicker({ formData, label, onFormDataChange }: ColorPickerProps): React.JSX.Element {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {PREDEFINED_COLORS.map(color => (
          <Box
            key={color}
            onClick={() => onFormDataChange({ ...formData, color })}
            sx={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.full,
              bgcolor: color,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: formData.color === color ? 3 : 0,
              transform: formData.color === color ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s',
              border: formData.color === color ? '2px solid white' : 'none',
              outline: formData.color === color ? `2px solid ${color}` : 'none',
            }}
          >
            {formData.color === color && <Check size={20} style={{ color: 'white' }} />}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function PreviewIcon({ formData }: { formData: CategoryFormData }): React.JSX.Element | null {
  const previewIconUrl = resolveIconUrl(formData.icon);
  if (formData.withoutIcon) {
    return null;
  }
  if (previewIconUrl) {
    return (
      <Box
        component="img"
        src={previewIconUrl}
        alt=""
        sx={{ width: 28, height: 28, objectFit: 'contain' }}
      />
    );
  }
  return <Tag size={28} />;
}

type PreviewProps = { formData: CategoryFormData; label: string; placeholder: string };
function CategoryPreview({ formData, label, placeholder }: PreviewProps): React.JSX.Element {
  const color = formData.color || '#2196F3';
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: tokens.radius.lg,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: tokens.radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(color, 0.1),
          color,
        }}
      >
        <PreviewIcon formData={formData} />
      </Box>
      <Typography variant="subtitle1" fontWeight="bold">
        {formData.name || placeholder}
      </Typography>
    </Box>
  );
}

export function CategoryForm({
  open,
  editingCategory,
  formData,
  uploadingIcon,
  onClose,
  onSave,
  onFormDataChange,
  onIconFileChange,
  labels,
}: CategoryFormProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        {editingCategory ? labels.editTitle : labels.createTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={labels.nameLabel}
              placeholder={labels.placeholderName}
              fullWidth
              value={formData.name}
              onChange={e => onFormDataChange({ ...formData, name: e.target.value })}
            />
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>{labels.typeLabel}</InputLabel>
              <Select
                value={formData.type}
                label={labels.typeLabel}
                onChange={e =>
                  onFormDataChange({ ...formData, type: e.target.value as 'income' | 'expense' })
                }
              >
                <MenuItem value="income">{labels.typeIncome}</MenuItem>
                <MenuItem value="expense">{labels.typeExpense}</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <IconPicker
            formData={formData}
            uploadingIcon={uploadingIcon}
            labels={labels}
            onFormDataChange={onFormDataChange}
            onIconFileChange={onIconFileChange}
          />
          <ColorPicker
            formData={formData}
            label={labels.chooseColor}
            onFormDataChange={onFormDataChange}
          />
          <CategoryPreview
            formData={formData}
            label={labels.preview}
            placeholder={labels.placeholderName}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {labels.cancel}
        </Button>
        <Button onClick={onSave} variant="contained" disabled={!formData.name}>
          {labels.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
