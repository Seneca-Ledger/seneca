import type { ConfigService } from '@nestjs/config';

// TypeORM loads the `migrations` glob with Node's own require, which cannot read
// the TypeScript migrations; hand it the classes Vite already compiled instead.
vi.mock('@/config/database.config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/config/database.config')>();
  const modules = import.meta.glob<Record<string, unknown>>('../../../src/migrations/*.ts', {
    eager: true,
  });
  const migrations = Object.keys(modules)
    .sort()
    .flatMap(file =>
      Object.values(modules[file]).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
  return {
    getDatabaseConfig: (configService: ConfigService) => ({
      ...actual.getDatabaseConfig(configService),
      migrations,
    }),
  };
});
