'use client';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ReactMarkdown, { type Components } from 'react-markdown';
import { X } from '@/app/components/icons';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { ModalShell } from './ui/modal-shell';

export interface ChangelogEntry {
  id: string;
  title: string;
  summary: string;
  markdown: string;
  date: string;
  version?: string;
  branch?: string;
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ChangelogEntry | null;
  releaseLabel: string;
  closeLabel: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <Typography
      variant="h4"
      component="h1"
      sx={{ mb: 2, fontWeight: 600, lineHeight: 1.25, color: 'text.primary' }}
    >
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography
      variant="h5"
      component="h2"
      sx={{ mb: 1.5, mt: 4, fontWeight: 600, lineHeight: 1.25, color: 'text.primary' }}
    >
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography
      variant="h6"
      component="h3"
      sx={{ mb: 1, mt: 3, fontWeight: 600, lineHeight: 1.25, color: 'text.primary' }}
    >
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography component="p" sx={{ mb: 2, color: 'text.primary' }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box
      component="ul"
      sx={{ mb: 2.5, pl: 3, color: 'text.primary', listStyleType: 'disc', '& li': { mb: 0.5 } }}
    >
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box
      component="ol"
      sx={{ mb: 2.5, pl: 3, color: 'text.primary', listStyleType: 'decimal', '& li': { mb: 0.5 } }}
    >
      {children}
    </Box>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 600, color: 'text.primary' }}>
      {children}
    </Box>
  ),
  code: ({ children }) => (
    <Box
      component="code"
      sx={{
        bgcolor: 'var(--muted)',
        px: 0.75,
        py: 0.25,
        fontSize: 13,
        color: 'text.primary',
        borderRadius: tokens.radius.xs,
      }}
    >
      {children}
    </Box>
  ),
};

export function ChangelogModal({
  isOpen,
  onClose,
  entry,
  releaseLabel,
  closeLabel,
}: ChangelogModalProps) {
  if (!entry) {
    return null;
  }

  const formattedDate = formatStoredDateTime(entry.date);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      showCloseButton={false}
      paperSx={{
        height: 'calc(100vh - 32px)',
        width: 'calc(100vw - 32px)',
        maxWidth: 'none',
        overflow: 'hidden',
        borderRadius: tokens.radius.xl,
        border: '1px solid var(--border-color)',
        boxShadow: '0 24px 80px rgba(16,24,40,0.16)',
      }}
      contentSx={{ height: '100%', p: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 2.5,
            py: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: 'text.secondary',
              }}
            >
              {releaseLabel}
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ fontWeight: 600, lineHeight: 1.25, color: 'text.primary' }}
            >
              {entry.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {formattedDate}
            </Typography>
          </Box>

          <IconButton
            onClick={onClose}
            aria-label={closeLabel}
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}
          >
            <X size={30} strokeWidth={2.4} />
          </IconButton>
        </Box>

        <Box
          sx={{
            minHeight: 0,
            flex: 1,
            overflowY: 'auto',
            bgcolor: 'background.default',
            px: 2.5,
            py: 3.5,
          }}
        >
          <Box
            component="article"
            sx={{
              mx: 'auto',
              width: '100%',
              maxWidth: '56rem',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              borderRadius: tokens.radius.lg,
              px: { xs: 3, sm: 4 },
              py: { xs: 3, sm: 4 },
              fontSize: 15,
              lineHeight: 1.75,
              color: 'text.primary',
            }}
          >
            <div className="changelog-markdown">
              <ReactMarkdown components={markdownComponents}>{entry.markdown}</ReactMarkdown>
            </div>
          </Box>
        </Box>
      </Box>
    </ModalShell>
  );
}
