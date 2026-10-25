// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoveryCodesDownloadButton } from './RecoveryCodesDownloadButton';
import { APP_NAME } from '@/app/lib/brand';
import { enTx as tx } from '@/app/settings/profile/helpers/en-tx';

const mocks = vi.hoisted(() => ({
  downloadRecoveryCodes: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/app/settings/profile/helpers/recovery-codes-file', () => ({
  downloadRecoveryCodes: mocks.downloadRecoveryCodes,
}));

vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'hi' }),
  // The shared Spinner reads its aria-label from the uiShell dictionary.
  useIntlayer: () => ({ loading: { value: 'Loading' } }),
}));

const codes = ['SV4EA-ZYFTP', 'F3DYA-87KRK'];

function renderPanel() {
  render(
    <RecoveryCodesDownloadButton
      tx={tx}
      codes={codes}
      email="user@example.com"
      formatPreferences={{}}
    />,
  );
}

function chooseFormat(label: string) {
  fireEvent.click(screen.getByRole('button', { name: tx(['securityCard', 'downloadButton']) }));
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
}

describe('RecoveryCodesDownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.downloadRecoveryCodes.mockResolvedValue(undefined);
  });

  it('offers PDF and Word under the Download button', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: tx(['securityCard', 'downloadButton']) }));

    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['PDF', 'Word (.docx)']);
  });

  it.each([
    ['PDF', 'pdf'],
    ['Word (.docx)', 'docx'],
  ])('builds the %s file from the codes on screen, the account and the UI locale', async (label, format) => {
    renderPanel();

    chooseFormat(label);

    await waitFor(() => expect(mocks.downloadRecoveryCodes).toHaveBeenCalledTimes(1));
    expect(mocks.downloadRecoveryCodes).toHaveBeenCalledWith(format, {
      locale: 'hi',
      title: `${APP_NAME} — ${tx(['securityCard', 'recoveryTitle'])}`,
      details: [
        `${tx(['securityCard', 'fileAccount'])}: user@example.com`,
        expect.stringMatching(new RegExp(`^${tx(['securityCard', 'fileGenerated'])}: \\S`)),
      ],
      hint: tx(['securityCard', 'fileHint']),
      codes,
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: tx(['securityCard', 'downloadButton']) }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
  });

  it('tells the user to copy the codes when the file cannot be built', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.downloadRecoveryCodes.mockRejectedValue(new Error('chunk load failed'));
    renderPanel();

    chooseFormat('PDF');

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(tx(['securityCard', 'downloadError'])),
    );
    expect(screen.getByRole('button', { name: tx(['securityCard', 'downloadButton']) }).hasAttribute('disabled')).toBe(false);
    consoleError.mockRestore();
  });
});
