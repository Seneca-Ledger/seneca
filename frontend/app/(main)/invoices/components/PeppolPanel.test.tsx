// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
  useLocale: () => ({ locale: 'en' }),
}));

import { PeppolIdField, suggestPeppolId } from './PeppolIdField';
import { PeppolPanel } from './PeppolPanel';

const transmission = {
  id: 't-1',
  recipient: '0208:0428643097',
  format: 'peppol_bis',
  status: 'failed',
  failure: 'Receiver rejected',
  createdAt: '2026-10-13T10:00:00.000Z',
  updatedAt: '2026-10-13T10:00:00.000Z',
};

describe('PeppolPanel', () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
  });

  it('shows nothing to a workspace without an access point', async () => {
    apiMocks.get.mockResolvedValue({ data: { connected: false } });
    const { container } = renderWithQuery(<PeppolPanel kind="invoice" documentId="inv-1" />);
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('lists what was sent and lets a failed send be tried again', async () => {
    apiMocks.get.mockImplementation(async (url: string) =>
      url === '/integrations/peppol/status' ? { data: { connected: true } } : { data: [transmission] },
    );
    renderWithQuery(<PeppolPanel kind="invoice" documentId="inv-1" />);
    expect(await screen.findByText('Receiver rejected')).toBeTruthy();
    expect(screen.getByText('→ 0208:0428643097')).toBeTruthy();
    const button = screen.getByTestId('peppol-send-invoice') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('names what Peppol still needs instead of a bare error', async () => {
    apiMocks.get.mockImplementation(async (url: string) =>
      url === '/integrations/peppol/status' ? { data: { connected: true } } : { data: [] },
    );
    const error = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { code: 'PEPPOL_DOCUMENT_INCOMPLETE', details: { missing: ['buyer_peppol_id'] } } },
      },
    });
    apiMocks.post.mockRejectedValue(error);
    renderWithQuery(<PeppolPanel kind="invoice" documentId="inv-1" />);
    fireEvent.click(await screen.findByTestId('peppol-send-invoice'));
    expect(await screen.findByText('missingBuyerPeppolId')).toBeTruthy();
    expect(apiMocks.post).toHaveBeenCalledWith('/invoices/inv-1/peppol');
  });
});

describe('PeppolIdField', () => {
  it('suggests the id a VAT number is usually registered under', () => {
    expect(suggestPeppolId('BE 0428.643.097')).toBe('0208:0428643097');
    expect(suggestPeppolId('DE123456789')).toBe('9930:DE123456789');
    expect(suggestPeppolId('PL1234567890')).toBeNull();
    const onChange = vi.fn();
    renderWithQuery(<PeppolIdField value="" vatId="DE123456789" onChange={onChange} />);
    fireEvent.click(screen.getByText('useSuggestion'));
    expect(onChange).toHaveBeenCalledWith('9930:DE123456789');
  });

  it('checks the id on the network and says what it accepts', async () => {
    apiMocks.post.mockResolvedValue({
      data: { registered: true, companyName: 'Klant NV', formats: ['peppol_bis'] },
    });
    renderWithQuery(<PeppolIdField value="0208:0428643097" vatId="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('check'));
    expect(await screen.findByTestId('peppol-lookup-result')).toBeTruthy();
    expect(apiMocks.post).toHaveBeenCalledWith('/peppol/lookup', { peppolId: '0208:0428643097' });
  });
});
