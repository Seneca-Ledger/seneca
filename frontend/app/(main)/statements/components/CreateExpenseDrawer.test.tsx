// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateExpenseDrawer from './CreateExpenseDrawer';

const isMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('./ExpenseAccountField', () => ({ ExpenseAccountField: () => null }));
vi.mock('@/app/hooks/useIsMobile', () => ({
  useIsMobile: () => isMobileMock(),
}));

const deviceLocationMock = vi.hoisted(() => vi.fn());
const locationAccessMock = vi.hoisted(() => ({
  supported: true,
  request: vi.fn(),
}));

vi.mock('@/app/lib/device-location', () => ({
  getDeviceLocation: () => deviceLocationMock(),
  isDeviceLocationSupported: () => locationAccessMock.supported,
  requestLocationAccess: () => locationAccessMock.request(),
}));

const CAPTURE_KEY = 'seneca-receipt-location-capture';

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: () => <input aria-label="Date" readOnly />,
}));

describe('CreateExpenseDrawer mobile uploads', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    isMobileMock.mockReturnValue(false);
  });

  it('uses camera-friendly file input in scan mode', async () => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={async () => undefined}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(uploadInput).toBeTruthy();
    expect(uploadInput?.getAttribute('accept')).toContain('image/*');
    expect(uploadInput?.getAttribute('accept')).not.toContain('.csv');
    expect(uploadInput?.getAttribute('accept')).not.toContain('.xlsx');
    expect(uploadInput?.getAttribute('accept')).not.toContain('.xls');
    expect(uploadInput?.getAttribute('capture')).toBe('environment');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps auto-categorization enabled for scan uploads', async () => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSubmitScan = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={onSubmitScan}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    const file = new File(['dummy'], 'statement.pdf', { type: 'application/pdf' });
    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
    });

    const submitButton = screen.getByRole('button', { name: /upload receipt/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmitScan).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [file],
        requireManualCategorySelection: false,
      }),
    );

    await act(async () => {
      root.unmount();
    });
  });

  it.each([
    ['onto the upload zone', () => screen.getByText(/drag and drop/i)],
    ['onto the drawer header, missing the zone', () => screen.getByText('Create expense')],
  ])('accepts receipts dropped %s instead of letting the browser open them', async (_where, target) => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSubmitScan = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={onSubmitScan}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    const receipt = new File(['dummy'], 'receipt.jpg', { type: 'image/jpeg' });
    const notes = new File(['dummy'], 'notes.csv', { type: 'text/csv' });
    const dropTarget = target();

    let dragOverAllowed = true;
    let dropAllowed = true;
    await act(async () => {
      dragOverAllowed = fireEvent.dragOver(dropTarget, {
        dataTransfer: { types: ['Files'], files: [receipt] },
      });
      dropAllowed = fireEvent.drop(dropTarget, {
        dataTransfer: { types: ['Files'], files: [receipt, notes] },
      });
    });

    // false = preventDefault was called, so the browser does not open the file itself.
    expect(dragOverAllowed).toBe(false);
    expect(dropAllowed).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    expect(onSubmitScan).toHaveBeenCalledWith(expect.objectContaining({ files: [receipt] }));

    await act(async () => {
      root.unmount();
    });
  });

  it('uses dark-safe drawer surfaces for scan and manual modes', async () => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={async () => undefined}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    const drawerSurface = document.querySelector('.seneca-expense-drawer');
    const lightSurface = Array.from(document.querySelectorAll('[class]')).find(
      node =>
        typeof node.className === 'string' &&
        (node.className.includes('bg-white') || node.className.includes('bg-[#ebe8e2]')),
    );

    expect(drawerSurface).toBeTruthy();
    expect(lightSurface).toBeUndefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('shows separate camera and gallery actions on mobile in scan mode', async () => {
    isMobileMock.mockReturnValue(true);

    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={async () => undefined}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose from gallery/i })).toBeInTheDocument();
    expect(screen.queryByText('Upload receipts')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose files')).not.toBeInTheDocument();

    const fileInputs = Array.from(
      document.querySelectorAll('input[type="file"]'),
    ) as HTMLInputElement[];
    expect(fileInputs).toHaveLength(2);
    expect(fileInputs[0]?.getAttribute('capture')).toBe('environment');
    expect(fileInputs[0]?.getAttribute('accept')).toBe('image/*');
    expect(fileInputs[1]?.getAttribute('accept')).toContain('image/*');

    await act(async () => {
      root.unmount();
    });
  });

  it('closes immediately on submit, letting the scan upload continue in the background', async () => {
    let finishUpload: (() => void) | undefined;
    const onSubmitScan = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finishUpload = resolve;
        }),
    );
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={onClose}
          onSubmitScan={onSubmitScan}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    const files = [
      new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ];
    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(uploadInput, { target: { files } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    expect(onClose).toHaveBeenCalled();
    expect(onSubmitScan).toHaveBeenCalledWith({
      files,
      allowDuplicates: true,
      requireManualCategorySelection: false,
      deviceLocationRequest: null,
    });

    await act(async () => {
      finishUpload?.();
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('creates and selects a tax rate from the manual tax drawer', async () => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCreateTaxRate = vi.fn().mockResolvedValue({
      id: 'tax-vat-12',
      name: 'VAT 12%',
      rate: 12,
      isDefault: false,
      isEnabled: true,
    });

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="manual"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={async () => undefined}
          onSubmitManual={async () => undefined}
          onCreateTaxRate={onCreateTaxRate}
        />,
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '20' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tax optional/i }));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/tax rate name/i), {
        target: { value: 'VAT 12%' },
      });
      fireEvent.change(screen.getByLabelText(/tax percentage/i), { target: { value: '12' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save tax rate/i }));
    });

    await waitFor(() => {
      expect(onCreateTaxRate).toHaveBeenCalledWith({
        name: 'VAT 12%',
        rate: 12,
        isEnabled: true,
      });
    });
    expect(screen.getAllByText('VAT 12% (12%)').length).toBeGreaterThan(0);

    await act(async () => {
      root.unmount();
    });
  });

  it('flags missing merchant and category only after Create is pressed', async () => {
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSubmitManual = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="manual"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={async () => undefined}
          onSubmitManual={onSubmitManual}
        />,
      );
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '20' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    expect(screen.queryByText('This field is required')).toBeNull();
    expect(screen.getByLabelText('Merchant')).not.toHaveAttribute('aria-invalid');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create .* expense/i }));
    });

    expect(screen.getAllByText('This field is required')).toHaveLength(2);
    expect(screen.getByLabelText('Merchant')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /category select category/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(onSubmitManual).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  const renderMobileScan = async (onSubmitScan: (payload: unknown) => Promise<void>) => {
    isMobileMock.mockReturnValue(true);
    const container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateExpenseDrawer
          open
          initialMode="scan"
          categories={[]}
          taxRates={[]}
          onClose={() => undefined}
          onSubmitScan={onSubmitScan}
          onSubmitManual={async () => undefined}
        />,
      );
    });

    return root;
  };

  it('attaches the device position to a photo taken with the camera', async () => {
    localStorage.setItem(CAPTURE_KEY, 'on');
    const location = { latitude: 43.2383, longitude: 76.9453, accuracy: 15 };
    deviceLocationMock.mockReset().mockResolvedValue(location);
    const onSubmitScan = vi.fn(async (_payload: unknown) => undefined);
    const root = await renderMobileScan(onSubmitScan);

    const shot = new File(['shot'], 'shot.jpg', { type: 'image/jpeg' });
    const cameraInput = document.querySelector('input[capture="environment"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cameraInput, { target: { files: [shot] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    expect(deviceLocationMock).toHaveBeenCalledTimes(1);
    expect(onSubmitScan).toHaveBeenCalledWith(
      expect.objectContaining({ files: [shot], deviceLocationRequest: expect.any(Promise) }),
    );
    const [payload] = onSubmitScan.mock.calls[0] as [{ deviceLocationRequest: Promise<unknown> }];
    await expect(payload.deviceLocationRequest).resolves.toEqual(location);

    await act(async () => {
      root.unmount();
    });
  });

  it('hands the files over before the location lookup settles', async () => {
    localStorage.setItem(CAPTURE_KEY, 'on');
    deviceLocationMock.mockReset().mockReturnValue(new Promise(() => undefined));
    const onSubmitScan = vi.fn(async (_payload: unknown) => undefined);
    const root = await renderMobileScan(onSubmitScan);

    const shot = new File(['shot'], 'shot.jpg', { type: 'image/jpeg' });
    const cameraInput = document.querySelector('input[capture="environment"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cameraInput, { target: { files: [shot] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    // The list puts up its placeholder rows from this call; it must not wait
    // for a location that may take seconds or never come.
    expect(onSubmitScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('does not ask for location when the photo comes from the gallery', async () => {
    deviceLocationMock.mockReset();
    const onSubmitScan = vi.fn(async (_payload: unknown) => undefined);
    const root = await renderMobileScan(onSubmitScan);

    const photo = new File(['old'], 'old.jpg', { type: 'image/jpeg' });
    const galleryInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(galleryInput, { target: { files: [photo] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    expect(deviceLocationMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onSubmitScan).toHaveBeenCalledWith(
        expect.objectContaining({ files: [photo], deviceLocationRequest: null }),
      ),
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('does not tag camera photos on a device where location was declined', async () => {
    localStorage.setItem(CAPTURE_KEY, 'off');
    deviceLocationMock.mockReset();
    const onSubmitScan = vi.fn(async (_payload: unknown) => undefined);
    const root = await renderMobileScan(onSubmitScan);

    const shot = new File(['shot'], 'shot.jpg', { type: 'image/jpeg' });
    const cameraInput = document.querySelector('input[capture="environment"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cameraInput, { target: { files: [shot] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));
    });

    expect(deviceLocationMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onSubmitScan).toHaveBeenCalledWith(
        expect.objectContaining({ deviceLocationRequest: null }),
      ),
    );

    await act(async () => {
      root.unmount();
    });
  });

  describe('location consent before the first camera shot', () => {
    beforeEach(() => {
      localStorage.removeItem(CAPTURE_KEY);
      locationAccessMock.supported = true;
      locationAccessMock.request.mockReset();
    });

    const cameraClickSpy = () =>
      vi.spyOn(
        document.querySelector('input[capture="environment"]') as HTMLInputElement,
        'click',
      );

    it('asks first instead of opening the camera on an undecided device', async () => {
      const root = await renderMobileScan(vi.fn(async (_payload: unknown) => undefined));
      const clickSpy = cameraClickSpy();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
      });

      expect(clickSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload receipt/i })).toBeDisabled();

      await act(async () => {
        root.unmount();
      });
    });

    it('remembers "Not now" and opens the camera in the same tap', async () => {
      const root = await renderMobileScan(vi.fn(async (_payload: unknown) => undefined));
      const clickSpy = cameraClickSpy();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /not now/i }));
      });

      expect(localStorage.getItem(CAPTURE_KEY)).toBe('off');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(locationAccessMock.request).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();

      await act(async () => {
        root.unmount();
      });
    });

    it('asks the browser on Allow, then offers to open the camera', async () => {
      locationAccessMock.request.mockResolvedValue('granted');
      const root = await renderMobileScan(vi.fn(async (_payload: unknown) => undefined));
      const clickSpy = cameraClickSpy();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
      });

      expect(locationAccessMock.request).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(CAPTURE_KEY)).toBe('on');
      expect(clickSpy).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open camera/i }));
      });
      expect(clickSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        root.unmount();
      });
    });

    it('does not ask again once the device has a choice', async () => {
      localStorage.setItem(CAPTURE_KEY, 'on');
      const root = await renderMobileScan(vi.fn(async (_payload: unknown) => undefined));
      const clickSpy = cameraClickSpy();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
      });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument();

      await act(async () => {
        root.unmount();
      });
    });

    it('skips the screen where the browser cannot share location', async () => {
      locationAccessMock.supported = false;
      const root = await renderMobileScan(vi.fn(async (_payload: unknown) => undefined));
      const clickSpy = cameraClickSpy();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
      });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(CAPTURE_KEY)).toBeNull();

      await act(async () => {
        root.unmount();
      });
    });
  });
});
