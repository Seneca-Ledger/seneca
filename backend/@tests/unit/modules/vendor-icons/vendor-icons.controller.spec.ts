import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { VendorIconsController } from '@/modules/vendor-icons/vendor-icons.controller';
import type { VendorIconsService } from '@/modules/vendor-icons/vendor-icons.service';

describe('VendorIconsController', () => {
  let service: { fetchIcon: jest.Mock };
  let controller: VendorIconsController;
  let res: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    service = { fetchIcon: jest.fn() };
    controller = new VendorIconsController(service as unknown as VendorIconsService);
    res = { setHeader: jest.fn(), send: jest.fn() };
  });

  it('sends the icon with a private cache header', async () => {
    const body = Buffer.from('png');
    service.fetchIcon.mockResolvedValue({ status: 'ok', body, contentType: 'image/png' });

    await controller.getIcon('netflix.com', res as unknown as Response);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=604800');
    expect(res.send).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', BadRequestException],
    ['missing', NotFoundException],
    ['unavailable', BadGatewayException],
  ])('maps %s to its http status', async (status, expected) => {
    service.fetchIcon.mockResolvedValue({ status });

    await expect(controller.getIcon('netflix.com', res as unknown as Response)).rejects.toThrow(
      expected,
    );
  });
});
