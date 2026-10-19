'use client';

import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import Alert from '@mui/material/Alert';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Layers,
  Mail,
  Receipt,
  Send,
  Share2,
  Table,
  TriangleAlert,
} from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useCategoryName } from '@/app/lib/use-category-name';
import type { GmailReceipt, ReceiptCategoryOption } from '../hooks/useGmailReceiptData';

interface GmailReceiptHeaderProps {
  receipt: GmailReceipt;
  statusLabel: string;
  lineItemsCount: number;
  hasCategoryIssues: boolean;
  hasCategory: boolean;
  hasDisabledCategory: boolean;
  selectedCategory: ReceiptCategoryOption | undefined;
  canSubmit: boolean;
  submitting: boolean;
  exporting: boolean;
  gmailMessageLink: string | null;
  readinessSeverity: 'success' | 'warning' | 'error';
  readinessInlineText: string;
  onOpenCategory: () => void;
  onSubmit: () => Promise<void>;
  onOpenPayable: () => void;
  onExportToGmailDraft: () => Promise<void>;
  onExportToXlsx: () => Promise<void>;
}

function CategoryButton({
  hasCategory,
  hasDisabledCategory,
  hasCategoryIssues,
  selectedCategory,
  onOpen,
}: {
  hasCategory: boolean;
  hasDisabledCategory: boolean;
  hasCategoryIssues: boolean;
  selectedCategory: ReceiptCategoryOption | undefined;
  onOpen: () => void;
}): React.ReactElement {
  const categoryName = useCategoryName();
  const selectedName = selectedCategory ? categoryName(selectedCategory.name) : undefined;
  const label = hasDisabledCategory
    ? `${selectedName} — disabled`
    : hasCategory
      ? selectedName
      : 'Category';

  const issueSx = {
    borderColor: 'var(--destructive) !important',
    color: 'var(--destructive) !important',
    bgcolor: 'var(--color-error-soft-bg) !important',
    borderWidth: '2px !important',
    '& .MuiButton-startIcon': { color: 'var(--destructive) !important' },
    '&:hover': {
      bgcolor: 'var(--color-error-soft-bg) !important',
      borderColor: 'var(--destructive) !important',
    },
  };

  const normalSx = {
    borderColor: 'var(--border-color)',
    color: 'var(--text-secondary)',
    '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' },
  };

  return (
    <Button
      variant="outlined"
      startIcon={<Layers size={18} />}
      onClick={onOpen}
      title={selectedName || 'Select category'}
      sx={{
        textTransform: 'none',
        fontWeight: 700,
        minWidth: 0,
        maxWidth: { xs: '100%', md: 280 },
        overflow: 'hidden',
        ...(hasCategoryIssues ? issueSx : normalSx),
      }}
    >
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {label}
      </Box>
    </Button>
  );
}

const sharedOutlinedSx = {
  textTransform: 'none',
  fontWeight: 600,
  borderColor: 'grey.300',
  color: 'text.secondary',
  '&:hover': { borderColor: 'primary.300', color: 'primary.700', bgcolor: 'primary.50' },
};

export function GmailReceiptHeader({
  receipt,
  statusLabel,
  lineItemsCount,
  hasCategoryIssues,
  hasCategory,
  hasDisabledCategory,
  selectedCategory,
  canSubmit,
  submitting,
  exporting,
  gmailMessageLink,
  readinessSeverity,
  readinessInlineText,
  onOpenCategory,
  onSubmit,
  onOpenPayable,
  onExportToGmailDraft,
  onExportToXlsx,
}: GmailReceiptHeaderProps): React.ReactElement {
  const router = useRouter();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.push('/statements')}
          sx={{
            mb: 3,
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back
        </Button>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 240 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 600, mb: 1, color: 'text.primary', letterSpacing: '-0.02em' }}
            >
              {receipt.subject}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                icon={<Receipt size={16} />}
                label={`${Math.max(1, lineItemsCount)} line items`}
                size="small"
                sx={theme => ({
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'grey.50',
                  color: 'text.secondary',
                  border: '1px solid',
                  borderColor: 'divider',
                  fontWeight: 500,
                  '& .MuiChip-icon': { color: 'text.secondary' },
                })}
              />
              <Chip
                label={statusLabel}
                size="small"
                sx={{
                  bgcolor: 'primary.50',
                  color: 'primary.700',
                  border: '1px solid',
                  borderColor: 'primary.200',
                  fontWeight: 600,
                }}
              />
              {hasCategoryIssues && (
                <Chip
                  icon={<TriangleAlert size={16} />}
                  label="Category required"
                  size="small"
                  sx={{
                    bgcolor: 'error.50',
                    color: 'error.800',
                    border: '1px solid',
                    borderColor: 'error.200',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'error.700' },
                  }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <CategoryButton
              hasCategory={hasCategory}
              hasDisabledCategory={hasDisabledCategory}
              hasCategoryIssues={hasCategoryIssues}
              selectedCategory={selectedCategory}
              onOpen={onOpenCategory}
            />

            <Tooltip title={!canSubmit ? 'Add amount before submitting' : ''} placement="top">
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="outlined"
                  startIcon={
                    submitting ? <Spinner className="h-[18px] w-[18px]" /> : <Send size={18} />
                  }
                  onClick={onSubmit}
                  disabled={!canSubmit || submitting}
                  sx={sharedOutlinedSx}
                >
                  Submit
                </Button>
              </span>
            </Tooltip>

            <Button
              variant="outlined"
              startIcon={<CreditCard size={18} />}
              onClick={onOpenPayable}
              sx={sharedOutlinedSx}
            >
              Pay
            </Button>

            <ButtonGroup
              variant="outlined"
              ref={setExportAnchorEl}
              sx={{ ...sharedOutlinedSx, border: 'none' }}
            >
              <Button
                startIcon={
                  exporting ? <Spinner className="h-[18px] w-[18px]" /> : <Share2 size={18} />
                }
                onClick={onExportToGmailDraft}
                disabled={exporting}
                sx={sharedOutlinedSx}
              >
                Export
              </Button>
              <Button
                size="small"
                onClick={() => setExportMenuOpen(prev => !prev)}
                disabled={exporting}
                sx={{ ...sharedOutlinedSx, minWidth: 28, px: 0.5 }}
              >
                <ChevronDown size={16} />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={exportAnchorEl}
              open={exportMenuOpen}
              onClose={() => setExportMenuOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportToGmailDraft();
                }}
              >
                <ListItemIcon>
                  <Mail size={16} />
                </ListItemIcon>
                <ListItemText>Export to Gmail Draft</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportToXlsx();
                }}
              >
                <ListItemIcon>
                  <Table size={16} />
                </ListItemIcon>
                <ListItemText>Export to Excel</ListItemText>
              </MenuItem>
            </Menu>

            <Button
              variant="outlined"
              startIcon={<Receipt size={18} />}
              component="a"
              href={gmailMessageLink || undefined}
              target="_blank"
              rel="noopener noreferrer"
              disabled={!gmailMessageLink}
              sx={{
                ...sharedOutlinedSx,
                color: gmailMessageLink ? 'text.secondary' : 'text.disabled',
              }}
            >
              Watch in Gmail
            </Button>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mb: 3,
          width: { xs: 'calc(100% + 32px)', sm: 'calc(100% + 48px)' },
          ml: { xs: -2, sm: -3 },
        }}
      >
        <Alert
          variant="filled"
          severity={readinessSeverity}
          sx={{
            px: { xs: 2.5, sm: 4 },
            py: 0.75,
            minHeight: 42,
            alignItems: 'center',
            '& .MuiAlert-message': { width: '100%', py: 0, overflow: 'hidden' },
            '& .MuiAlert-icon': { py: 0, mr: 1.25, alignItems: 'center' },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              width: '100%',
              fontWeight: 600,
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={readinessInlineText}
          >
            {readinessInlineText}
          </Typography>
        </Alert>
      </Box>
    </>
  );
}
