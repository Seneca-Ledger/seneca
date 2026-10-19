'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/theme-tokens';

interface ServiceIntegrationSuggestionsProps {
  onSkip: () => void;
  workspaceId: string;
}

const INTEGRATIONS = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Import bank statements directly from your Google Drive',
    icon: '/icons/google-drive-icon.png',
    path: '/integrations/google-drive',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Automatically extract receipts and invoices from emails',
    icon: '/icons/gmail.png',
    path: '/integrations/gmail',
  },
];

export function ServiceIntegrationSuggestions({
  onSkip,
  workspaceId,
}: ServiceIntegrationSuggestionsProps) {
  const router = useRouter();

  const handleConnect = (path: string) => {
    router.push(path);
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--foreground)', mb: 1 }}>
          Connect Your Services
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
          Enhance your workspace by connecting external services. You can always do this later.
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        {INTEGRATIONS.map(integration => (
          <Box
            key={integration.id}
            sx={{
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              p: 2,
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flexShrink: 0, width: 48, height: 48, position: 'relative' }}>
                <Image
                  src={integration.icon}
                  alt={integration.name}
                  width={48}
                  height={48}
                  style={{ objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  fontWeight={600}
                  sx={{ color: 'var(--foreground)', mb: 0.5 }}
                >
                  {integration.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--muted-foreground)', mb: 1.5 }}>
                  {integration.description}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleConnect(integration.path)}
                  sx={{ borderRadius: tokens.radius.md }}
                >
                  Connect
                </Button>
              </Box>
            </Box>
          </Box>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
        <Button variant="text" onClick={onSkip} sx={{ color: 'var(--muted-foreground)' }}>
          Skip for now
        </Button>
      </Box>
    </Stack>
  );
}
