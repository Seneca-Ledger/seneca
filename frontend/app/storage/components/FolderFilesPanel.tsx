'use client';

import { Box, TextField, Typography } from '@mui/material';
import React from 'react';
import { FileX, Search } from '@/app/components/icons';
import type { StorageFile } from '../storageHelpers';
import { DraggableModalFileItem } from './DraggableModalFileItem';

export interface FolderFilesPanelProps {
  activeFolderLabel: React.ReactNode;
  folderModalFiles: StorageFile[];
  folderFileQuery: string;
  draggingFile: StorageFile | null;
  dragDropTitleLabel: React.ReactNode;
  modalsFilesLabel: React.ReactNode;
  modalsFileSearchPlaceholder: string;
  modalsFilesEmpty: React.ReactNode;
  dragDropRowHintLabel: string;
  tableFromLabel: string;
  onSetFolderFileQuery: (query: string) => void;
  canEditFile: (file: StorageFile) => boolean;
}

const searchIconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  color: 'var(--muted-foreground)',
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
};
const emptyIconSx = {
  mx: 'auto',
  mb: 2,
  display: 'flex',
  width: 64,
  height: 64,
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: 'var(--muted)',
  color: 'var(--border-color)',
};

function FilePanelEmpty({
  modalsFilesEmpty,
}: {
  modalsFilesEmpty: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
      <Box sx={emptyIconSx}>
        <FileX size={32} />
      </Box>
      <Typography style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {modalsFilesEmpty}
      </Typography>
    </Box>
  );
}

function FilePanelSearch({
  folderFileQuery,
  modalsFileSearchPlaceholder,
  onSetFolderFileQuery,
}: {
  folderFileQuery: string;
  modalsFileSearchPlaceholder: string;
  onSetFolderFileQuery: (q: string) => void;
}): React.JSX.Element {
  return (
    <Box sx={{ position: 'relative', mt: 1.5 }}>
      <Search style={searchIconStyle} />
      <TextField
        size="small"
        value={folderFileQuery}
        placeholder={modalsFileSearchPlaceholder}
        onChange={e => onSetFolderFileQuery(e.target.value)}
        sx={{ width: '100%', '& .MuiOutlinedInput-root': { pl: 4 } }}
      />
    </Box>
  );
}

function FilePanelHeader({
  activeFolderLabel,
  modalsFilesLabel,
  folderModalFiles,
  draggingFile,
  dragDropTitleLabel,
}: {
  activeFolderLabel: React.ReactNode;
  modalsFilesLabel: React.ReactNode;
  folderModalFiles: StorageFile[];
  draggingFile: StorageFile | null;
  dragDropTitleLabel: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {activeFolderLabel}
        </Typography>
        <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {modalsFilesLabel} · {folderModalFiles.length}
        </Typography>
      </Box>
      {draggingFile && (
        <Typography style={{ fontSize: 12, color: 'var(--color-primary, #168118)' }}>
          {dragDropTitleLabel}
        </Typography>
      )}
    </Box>
  );
}

export function FolderFilesPanel({
  activeFolderLabel,
  folderModalFiles,
  folderFileQuery,
  draggingFile,
  dragDropTitleLabel,
  modalsFilesLabel,
  modalsFilesEmpty,
  modalsFileSearchPlaceholder,
  dragDropRowHintLabel,
  tableFromLabel,
  onSetFolderFileQuery,
  canEditFile,
}: FolderFilesPanelProps): React.JSX.Element {
  return (
    <Box sx={{ border: '1px solid var(--border-color)', p: 2 }}>
      <FilePanelHeader
        activeFolderLabel={activeFolderLabel}
        modalsFilesLabel={modalsFilesLabel}
        folderModalFiles={folderModalFiles}
        draggingFile={draggingFile}
        dragDropTitleLabel={dragDropTitleLabel}
      />
      <FilePanelSearch
        folderFileQuery={folderFileQuery}
        modalsFileSearchPlaceholder={modalsFileSearchPlaceholder}
        onSetFolderFileQuery={onSetFolderFileQuery}
      />
      <Box sx={{ mt: 1.5, maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--muted)' }}>
        {folderModalFiles.length === 0 ? (
          <FilePanelEmpty modalsFilesEmpty={modalsFilesEmpty} />
        ) : (
          folderModalFiles.map(file => (
            <DraggableModalFileItem
              key={file.id}
              file={file}
              canEditFile={canEditFile}
              rowHintLabel={dragDropRowHintLabel}
              tableFromLabel={tableFromLabel}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
