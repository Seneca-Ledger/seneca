import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const runMigrationsEnv = (configService.get<string>('RUN_MIGRATIONS') || '').toLowerCase();
  // Default to running migrations everywhere unless explicitly disabled.
  // This prevents production deployments from silently missing new tables/enums.
  const shouldRunMigrations = runMigrationsEnv !== 'false';
  const migrationsGlob = __filename.endsWith('.ts')
    ? 'src/migrations/*.ts'
    : 'dist/migrations/*.js';
  const databaseUrl =
    configService.get<string>('DATABASE_URL') ||
    'postgresql://finflow:finflow@localhost:5432/finflow';
  // In dev, nodemon keeps the container alive after a crash, so Docker never restarts it.
  // After a Docker/host restart the backend can come up before postgres; wait ~3 min instead of ~27 s.
  const isDevelopment = configService.get<string>('NODE_ENV') === 'development';

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true,
    synchronize: false,
    // Query logging is opt-in: it floods dev logs with thousands of lines.
    logging: configService.get<string>('DB_QUERY_LOGGING') === 'true',
    migrations: [migrationsGlob],
    migrationsRun: shouldRunMigrations,
    ...(isDevelopment && { retryAttempts: 60, retryDelay: 3000 }),
  };
};
