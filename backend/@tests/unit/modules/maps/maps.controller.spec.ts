import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { MapsController } from '@/modules/maps/maps.controller';
import type { MapsService } from '@/modules/maps/maps.service';

describe('MapsController', () => {
  let service: { getStyles: jest.Mock; fetchTile: jest.Mock };
  let controller: MapsController;
  let res: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    service = {
      getStyles: jest.fn().mockResolvedValue({ styles: [], defaultStyleId: null }),
      fetchTile: jest.fn(),
    };
    controller = new MapsController(service as unknown as MapsService);
    res = { setHeader: jest.fn(), send: jest.fn() };
  });

  it('returns the style list', async () => {
    await expect(controller.getStyles()).resolves.toEqual({ styles: [], defaultStyleId: null });
  });

  it('streams a tile with a private cache header', async () => {
    const body = Buffer.from('png');
    service.fetchTile.mockResolvedValue({ status: 'ok', body, contentType: 'image/png' });

    await controller.getTile('osm-bright', '3', '1', '2.png', res as unknown as Response);

    expect(service.fetchTile).toHaveBeenCalledWith('osm-bright', '3', '1', '2.png');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=86400');
    expect(res.send).toHaveBeenCalledWith(body);
  });

  it('answers 400 for an unknown style or tile', async () => {
    service.fetchTile.mockResolvedValue({ status: 'invalid' });

    await expect(
      controller.getTile('nope', '0', '0', '0.png', res as unknown as Response),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('answers 502 when the tile server is down', async () => {
    service.fetchTile.mockResolvedValue({ status: 'unavailable' });

    await expect(
      controller.getTile('osm-bright', '0', '0', '0.png', res as unknown as Response),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
