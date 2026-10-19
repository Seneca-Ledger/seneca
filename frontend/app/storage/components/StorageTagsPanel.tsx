'use client';

import { Box, IconButton, Popover, TextField, Typography } from '@mui/material';
import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check, PencilLine, Plus, Trash2, X } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { TagOption } from '../storageHelpers';
import { colorPickerPopoverSlotProps } from '../storageHelpers';

export interface StorageTagsPanelProps {
  tags: TagOption[];
  tagCounts: Record<string, number>;
  newTagName: string;
  newTagColor: string;
  newTagPickerOpen: boolean;
  newTagAnchorEl: HTMLElement | null;
  editingTagId: string | null;
  editingTagName: string;
  editingTagColor: string | null;
  editingTagPickerId: string | null;
  editingTagAnchorEl: HTMLElement | null;
  tagsTitleLabel: React.ReactNode;
  tagsCreatePlaceholder: string;
  tagsCreateTooltip: string;
  tagColorLabel: string;
  tagsRenameTooltip: string;
  tagsDeleteTooltip: string;
  tagsEmpty: React.ReactNode;
  onSetNewTagName: (name: string) => void;
  onSetNewTagColor: (color: string) => void;
  onSetNewTagPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSetNewTagAnchorEl: (el: HTMLElement | null) => void;
  onSetEditingTagName: (name: string) => void;
  onSetEditingTagColor: (color: string | null) => void;
  onSetEditingTagPickerId: React.Dispatch<React.SetStateAction<string | null>>;
  onSetEditingTagAnchorEl: (el: HTMLElement | null) => void;
  onCreateTag: () => void;
  onStartEditTag: (tag: TagOption) => void;
  onRenameTag: (id: string) => void;
  onCancelEditTag: () => void;
  onConfirmDeleteTag: (tag: TagOption) => void;
  canEditTag: (tag: TagOption) => boolean;
}

export function StorageTagsPanel({
  tags,
  tagCounts,
  newTagName,
  newTagColor,
  newTagPickerOpen,
  newTagAnchorEl,
  editingTagId,
  editingTagName,
  editingTagColor,
  editingTagPickerId,
  editingTagAnchorEl,
  tagsTitleLabel,
  tagsCreatePlaceholder,
  tagsCreateTooltip,
  tagColorLabel,
  tagsRenameTooltip,
  tagsDeleteTooltip,
  tagsEmpty,
  onSetNewTagName,
  onSetNewTagColor,
  onSetNewTagPickerOpen,
  onSetNewTagAnchorEl,
  onSetEditingTagName,
  onSetEditingTagColor,
  onSetEditingTagPickerId,
  onSetEditingTagAnchorEl,
  onCreateTag,
  onStartEditTag,
  onRenameTag,
  onCancelEditTag,
  onConfirmDeleteTag,
  canEditTag,
}: StorageTagsPanelProps): React.JSX.Element {
  return (
    <Box sx={{ border: '1px solid var(--border-color)', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {tagsTitleLabel}
        </Typography>
        <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {tags.length}
        </Typography>
      </Box>
      <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          value={newTagName}
          onChange={event => onSetNewTagName(event.target.value)}
          placeholder={tagsCreatePlaceholder}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <Box sx={{ position: 'relative' }}>
          <IconButton
            size="small"
            onClick={event => {
              onSetNewTagAnchorEl(event.currentTarget);
              onSetNewTagPickerOpen(prev => !prev);
            }}
            aria-label={tagColorLabel}
            sx={{
              border: '1px solid var(--border-color)',
              borderRadius: tokens.radius.full,
              p: 0.5,
            }}
          >
            <Box
              sx={{ width: 24, height: 24, borderRadius: tokens.radius.full, bgcolor: newTagColor }}
            />
          </IconButton>
          <Popover
            open={newTagPickerOpen}
            anchorEl={newTagAnchorEl}
            onClose={() => {
              onSetNewTagPickerOpen(false);
              onSetNewTagAnchorEl(null);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={colorPickerPopoverSlotProps}
          >
            <HexColorPicker color={newTagColor} onChange={onSetNewTagColor} />
          </Popover>
        </Box>
        <IconButton
          onClick={onCreateTag}
          title={tagsCreateTooltip}
          sx={{
            bgcolor: 'var(--primary-fill)',
            color: '#fff',
            borderRadius: tokens.radius.full,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <Plus size={18} />
        </IconButton>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxHeight: '30vh',
          overflowY: 'auto',
          minHeight: 200,
          pb: 13,
        }}
      >
        {tags.length === 0 ? (
          <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {tagsEmpty}
          </Typography>
        ) : (
          tags.map(tag => (
            <TagItem
              key={tag.id}
              tag={tag}
              count={tagCounts[tag.id] ?? 0}
              editingTagId={editingTagId}
              editingTagName={editingTagName}
              editingTagColor={editingTagColor}
              editingTagPickerId={editingTagPickerId}
              editingTagAnchorEl={editingTagAnchorEl}
              tagColorLabel={tagColorLabel}
              tagsRenameTooltip={tagsRenameTooltip}
              tagsDeleteTooltip={tagsDeleteTooltip}
              onSetEditingTagName={onSetEditingTagName}
              onSetEditingTagColor={onSetEditingTagColor}
              onSetEditingTagPickerId={onSetEditingTagPickerId}
              onSetEditingTagAnchorEl={onSetEditingTagAnchorEl}
              onStartEditTag={onStartEditTag}
              onRenameTag={onRenameTag}
              onCancelEditTag={onCancelEditTag}
              onConfirmDeleteTag={onConfirmDeleteTag}
              canEditTag={canEditTag}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

interface TagItemProps {
  tag: TagOption;
  count: number;
  editingTagId: string | null;
  editingTagName: string;
  editingTagColor: string | null;
  editingTagPickerId: string | null;
  editingTagAnchorEl: HTMLElement | null;
  tagColorLabel: string;
  tagsRenameTooltip: string;
  tagsDeleteTooltip: string;
  onSetEditingTagName: (name: string) => void;
  onSetEditingTagColor: (color: string | null) => void;
  onSetEditingTagPickerId: React.Dispatch<React.SetStateAction<string | null>>;
  onSetEditingTagAnchorEl: (el: HTMLElement | null) => void;
  onStartEditTag: (tag: TagOption) => void;
  onRenameTag: (id: string) => void;
  onCancelEditTag: () => void;
  onConfirmDeleteTag: (tag: TagOption) => void;
  canEditTag: (tag: TagOption) => boolean;
}

function TagItem({
  tag,
  count,
  editingTagId,
  editingTagName,
  editingTagColor,
  editingTagPickerId,
  editingTagAnchorEl,
  tagColorLabel,
  tagsRenameTooltip,
  tagsDeleteTooltip,
  onSetEditingTagName,
  onSetEditingTagColor,
  onSetEditingTagPickerId,
  onSetEditingTagAnchorEl,
  onStartEditTag,
  onRenameTag,
  onCancelEditTag,
  onConfirmDeleteTag,
  canEditTag,
}: TagItemProps): React.JSX.Element {
  const isEditing = editingTagId === tag.id;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        border: '1px solid var(--muted)',
        px: 1.5,
        py: 1,
      }}
    >
      {isEditing ? (
        <TagEditRow
          tag={tag}
          editingTagName={editingTagName}
          editingTagColor={editingTagColor}
          editingTagPickerId={editingTagPickerId}
          editingTagAnchorEl={editingTagAnchorEl}
          tagColorLabel={tagColorLabel}
          onSetEditingTagName={onSetEditingTagName}
          onSetEditingTagColor={onSetEditingTagColor}
          onSetEditingTagPickerId={onSetEditingTagPickerId}
          onSetEditingTagAnchorEl={onSetEditingTagAnchorEl}
          onRenameTag={onRenameTag}
          onCancelEditTag={onCancelEditTag}
        />
      ) : (
        <TagViewRow
          tag={tag}
          count={count}
          tagsRenameTooltip={tagsRenameTooltip}
          tagsDeleteTooltip={tagsDeleteTooltip}
          onStartEditTag={onStartEditTag}
          onConfirmDeleteTag={onConfirmDeleteTag}
          canEditTag={canEditTag}
        />
      )}
    </Box>
  );
}

interface TagEditRowProps {
  tag: TagOption;
  editingTagName: string;
  editingTagColor: string | null;
  editingTagPickerId: string | null;
  editingTagAnchorEl: HTMLElement | null;
  tagColorLabel: string;
  onSetEditingTagName: (name: string) => void;
  onSetEditingTagColor: (color: string | null) => void;
  onSetEditingTagPickerId: React.Dispatch<React.SetStateAction<string | null>>;
  onSetEditingTagAnchorEl: (el: HTMLElement | null) => void;
  onRenameTag: (id: string) => void;
  onCancelEditTag: () => void;
}

function TagEditRow({
  tag,
  editingTagName,
  editingTagColor,
  editingTagPickerId,
  editingTagAnchorEl,
  tagColorLabel,
  onSetEditingTagName,
  onSetEditingTagColor,
  onSetEditingTagPickerId,
  onSetEditingTagAnchorEl,
  onRenameTag,
  onCancelEditTag,
}: TagEditRowProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          value={editingTagName}
          onChange={event => onSetEditingTagName(event.target.value)}
          sx={{ flex: 1 }}
        />
        <Box sx={{ position: 'relative' }}>
          <IconButton
            size="small"
            onClick={event => {
              onSetEditingTagAnchorEl(event.currentTarget);
              onSetEditingTagPickerId(prev => (prev === tag.id ? null : tag.id));
            }}
            aria-label={tagColorLabel}
            sx={{
              border: '1px solid var(--border-color)',
              borderRadius: tokens.radius.full,
              p: 0.5,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: tokens.radius.full,
                bgcolor: editingTagColor ?? '#168118',
              }}
            />
          </IconButton>
          <Popover
            open={editingTagPickerId === tag.id}
            anchorEl={editingTagAnchorEl}
            onClose={() => {
              onSetEditingTagPickerId(null);
              onSetEditingTagAnchorEl(null);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={colorPickerPopoverSlotProps}
          >
            <HexColorPicker color={editingTagColor ?? '#168118'} onChange={onSetEditingTagColor} />
          </Popover>
        </Box>
        <IconButton
          size="small"
          onClick={() => onRenameTag(tag.id)}
          sx={{
            bgcolor: 'var(--primary-fill)',
            color: '#fff',
            borderRadius: tokens.radius.full,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <Check size={16} />
        </IconButton>
        <IconButton
          size="small"
          onClick={onCancelEditTag}
          sx={{
            border: '1px solid var(--border-color)',
            borderRadius: tokens.radius.full,
            color: 'var(--muted-foreground)',
            '&:hover': { bgcolor: 'var(--muted)' },
          }}
        >
          <X size={16} />
        </IconButton>
      </Box>
    </Box>
  );
}

interface TagViewRowProps {
  tag: TagOption;
  count: number;
  tagsRenameTooltip: string;
  tagsDeleteTooltip: string;
  onStartEditTag: (tag: TagOption) => void;
  onConfirmDeleteTag: (tag: TagOption) => void;
  canEditTag: (tag: TagOption) => boolean;
}

function TagViewRow({
  tag,
  count,
  tagsRenameTooltip,
  tagsDeleteTooltip,
  onStartEditTag,
  onConfirmDeleteTag,
  canEditTag,
}: TagViewRowProps): React.JSX.Element {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: tokens.radius.full,
            bgcolor: tag.color ?? 'var(--muted-foreground)',
            flexShrink: 0,
          }}
        />
        <Typography
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tag.name}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{count}</Typography>
        {canEditTag(tag) && (
          <>
            <IconButton
              size="small"
              onClick={() => onStartEditTag(tag)}
              title={tagsRenameTooltip}
              sx={{
                border: '1px solid var(--border-color)',
                borderRadius: tokens.radius.full,
                color: 'var(--muted-foreground)',
                '&:hover': { bgcolor: 'var(--muted)' },
              }}
            >
              <PencilLine size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onConfirmDeleteTag(tag)}
              title={tagsDeleteTooltip}
              sx={{
                border: '1px solid var(--border-color)',
                borderRadius: tokens.radius.full,
                color: 'var(--muted-foreground)',
                '&:hover': { color: 'var(--destructive)', bgcolor: 'var(--color-error-soft-bg)' },
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          </>
        )}
      </Box>
    </>
  );
}
