import {
  Box,
  Container,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

/** The edit page's placeholder while the statement loads. */
export function EditStatementSkeleton(): React.JSX.Element {
  const rows = Array.from({ length: 7 });

  return (
    <Container
      maxWidth={false}
      data-testid="statement-edit-loading"
      sx={{ py: 5, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
    >
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={80} height={32} sx={{ mb: 3 }} />
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
            <Skeleton variant="text" width={280} height={40} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" width={140} height={24} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={160} height={36} />
            <Skeleton variant="rounded" width={120} height={36} />
            <Skeleton variant="rounded" width={100} height={36} />
          </Box>
        </Box>
      </Box>

      <Skeleton variant="rounded" height={42} sx={{ mb: 3 }} />

      <Box
        sx={{
          mb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Paper
            key={index}
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'grey.200', p: 2 }}
          >
            <Skeleton variant="text" width="50%" height={16} />
            <Skeleton variant="text" width="70%" height={24} sx={{ mt: 0.5 }} />
          </Paper>
        ))}
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'grey.200' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Skeleton variant="rectangular" width={18} height={18} />
              </TableCell>
              {Array.from({ length: 6 }).map((_, index) => (
                <TableCell key={index}>
                  <Skeleton variant="text" width="60%" height={20} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rectangular" width={18} height={18} />
                </TableCell>
                {Array.from({ length: 6 }).map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton variant="text" width="80%" height={20} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
