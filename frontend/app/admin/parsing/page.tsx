'use client';

import { Alert, Button, Container, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import type { ParserHealth } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { ParserHealthBankCard } from './components/ParserHealthBankCard';

const SKELETON_KEYS = ['bank-0', 'bank-1', 'bank-2'];

/**
 * Parser health for the server's administrator: per bank, how statements
 * parsed over the last 30 days and the layouts they came in, so a bank that
 * changes its format shows up before its users notice.
 */
export default function ParserHealthPage(): React.ReactElement {
  const t = useIntlayer('adminParsingPage');
  const adminPage = useIntlayer('adminPage');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.parserHealth(),
    queryFn: ({ signal }): Promise<ParserHealth> =>
      apiQueryDecoded({ url: '/parsing/health', signal, contract: 'ParserHealth' }),
    enabled: isAdmin,
  });

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: { xs: 2, md: 4 } }}>
      <Button
        component={Link}
        href="/admin"
        size="small"
        startIcon={<ArrowLeft size={16} />}
        sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
      >
        {adminPage.title}
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        {t.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t.subtitle}
      </Typography>
      {!isAdmin ? (
        <Alert severity="info">{t.notAdmin}</Alert>
      ) : query.isError ? (
        <Alert severity="error">{t.loadFailed}</Alert>
      ) : query.isPending ? (
        <Stack spacing={2}>
          {SKELETON_KEYS.map(key => (
            <Skeleton key={key} variant="rounded" height={140} />
          ))}
        </Stack>
      ) : query.data.banks.length === 0 ? (
        <Alert severity="info">{t.empty}</Alert>
      ) : (
        <Stack spacing={2}>
          {query.data.banks.map(bank => (
            <ParserHealthBankCard key={bank.bank} bank={bank} />
          ))}
        </Stack>
      )}
    </Container>
  );
}
