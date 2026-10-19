import { UsersController } from '@/modules/users/users.controller';

describe('UsersController', () => {
  it('returns timezones list from service', async () => {
    const timezonesService = {
      listTimeZones: jest.fn(() => [{ value: 'UTC', label: '(GMT+00:00) UTC' }]),
    };
    const controller = new UsersController(
      {} as any,
      {} as any,
      {} as any,
      timezonesService as any,
      {} as any,
    );

    const result = await controller.getTimeZones();

    expect(result).toEqual({ timeZones: [{ value: 'UTC', label: '(GMT+00:00) UTC' }] });
  });
});
