'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useRef, useState } from 'react';
import { Spinner } from '@/app/components/ui/spinner';
import type { ExchangeImportResult } from '../hooks/useCrypto';

type ExchangeImportButtonProps = {
  importing: boolean;
  labels: { button: string; hint: string; failed: string; done: string };
  onImport: (file: File) => Promise<ExchangeImportResult | null>;
};

/**
 * Most people's coins sit on an exchange, and every exchange hands out a CSV of
 * the account's history. One button: pick the file, and the account turns into a
 * wallet like any other.
 */
export function ExchangeImportButton({
  importing,
  labels,
  onImport,
}: ExchangeImportButtonProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ExchangeImportResult | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    // The same file twice in a row must still fire a change event.
    event.target.value = '';
    if (!file) {
      return;
    }
    setFailed(false);
    setResult(null);
    const imported = await onImport(file);
    if (imported) {
      setResult(imported);
    } else {
      setFailed(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {/* The outcome sits next to the button as one line: an import either took
          the file or did not, which is not worth a box of its own. */}
      {(failed || result) && (
        <Typography
          variant="caption"
          sx={{ color: failed ? 'var(--ff-dash-critical)' : 'text.secondary', maxWidth: 320 }}
        >
          {failed ? labels.failed : `${result?.exchange} — ${labels.done}: ${result?.imported}`}
        </Typography>
      )}
      <Tooltip title={labels.hint}>
        <span>
          <Button
            variant="outlined"
            disabled={importing}
            startIcon={importing ? <Spinner size={16} /> : undefined}
            onClick={() => input.current?.click()}
          >
            {labels.button}
          </Button>
        </span>
      </Tooltip>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={pick}
        data-testid="exchange-csv-input"
      />
    </Box>
  );
}
