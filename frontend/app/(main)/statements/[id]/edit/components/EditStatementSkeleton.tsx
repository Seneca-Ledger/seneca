import {
  Box,
  Button,
  Container,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronDown, Layers } from '@/app/components/icons';
import { StatementTagsField } from '@/app/components/tags/RecordTagsField';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { useIntlayer } from '@/app/i18n';
import { getColumnLabels } from '../helpers/transactionDisplayHelpers';

const HEADER_SX = { fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' } as const;
const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
// Names and amounts differ in length from row to row, as real ones do.
const SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75, 0.9];

/**
 * The edit page while the statement loads: its own buttons, card labels and
 * column titles, with placeholders where the statement's values go.
 */
export function EditStatementSkeleton(): React.JSX.Element {
  const router = useRouter();
  const params = useParams();
  const t = useIntlayer('statementEditPage');
  const labels = t.labels as Record<string, { value: string }>;
  const columns = getColumnLabels(t.columns as Record<string, { value?: string }>);
  const cards = [labels.balanceStart, labels.expenses, labels.income, labels.closingBalance];

  return (
    <Container
      maxWidth={false}
      data-testid="statement-edit-loading"
      aria-busy="true"
      sx={{ py: 5, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
    >
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.back()}
          sx={{ mb: 3, color: 'text.secondary', textTransform: 'none', fontWeight: 500 }}
        >
          {t.labels.back}
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
            <Skeleton variant="text" width={280} height={42} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width={240} height={20} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <DetailActionButton disabled style={{ padding: '8px 16px', fontWeight: 500 }}>
              <Layers size={18} style={{ color: 'var(--text-muted)' }} />
              {labels.categoryButton?.value}
            </DetailActionButton>
            <DetailActionButton disabled>{t.labels.exportButton.value}</DetailActionButton>
            <DetailActionButton variant="outline" disabled>
              <CheckCircle2 size={18} />
              {labels.confirmAll?.value}
            </DetailActionButton>
          </Box>
        </Box>
      </Box>

      <Skeleton variant="rounded" height={42} sx={{ mb: 3, borderRadius: 1.5 }} />

      {/* The tags load on their own, so they show for real. */}
      <Box sx={{ mb: 2 }}>
        <StatementTagsField statementId={params.id as string} />
      </Box>

      <Box
        sx={{
          mb: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {cards.map(card => (
          <Paper
            key={card?.value}
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}
          >
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{card?.value}</Typography>
            <Skeleton variant="text" width="45%" height={24} sx={{ mt: 0.5 }} />
          </Paper>
        ))}
      </Box>

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'var(--primary)' }}>
          {t.labels.parsingDetails?.value}
        </Typography>
        <ChevronDown size={16} style={{ color: 'var(--primary)' }} />
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        className="seneca-stmt-edit-table"
        sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <TableCell padding="checkbox">
                <Skeleton variant="rounded" width={16} height={16} />
              </TableCell>
              <TableCell sx={HEADER_SX}>{columns.date}</TableCell>
              <TableCell sx={HEADER_SX}>{columns.counterparty}</TableCell>
              <TableCell sx={HEADER_SX}>{columns.paymentPurpose}</TableCell>
              <TableCell align="right" sx={HEADER_SX}>
                {columns.amount}
              </TableCell>
              <TableCell sx={HEADER_SX}>{columns.category}</TableCell>
              <TableCell sx={HEADER_SX}>
                <span className="u-visually-hidden">{columns.actions}</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROW_KEYS.map((key, row) => (
              <TableRow key={key}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rounded" width={16} height={16} />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" width={Math.round(140 * SHARES[row])} />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" width={Math.round(200 * SHARES[(row + 3) % 7])} />
                </TableCell>
                <TableCell align="right">
                  <Skeleton
                    variant="text"
                    width={Math.round(80 * SHARES[(row + 1) % 7])}
                    sx={{ display: 'inline-block' }}
                  />
                </TableCell>
                <TableCell>
                  <Skeleton variant="rounded" width={110} height={24} />
                </TableCell>
                <TableCell>
                  <Skeleton variant="circular" width={24} height={24} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
