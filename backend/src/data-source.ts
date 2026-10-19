import { config } from 'dotenv';
import { existsSync } from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

// Load environment variables
config();

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5432/finflow';

const resolveCompiledGlob = (compiledDirName: string, sourceDirName: string) => {
  const compiledDir = path.join(__dirname, compiledDirName);
  const compiledUnderSrcDir = path.join(__dirname, 'src', compiledDirName);

  if (existsSync(compiledDir)) {
    return path.join(compiledDir, '*.{ts,js}');
  }

  if (existsSync(compiledUnderSrcDir)) {
    return path.join(compiledUnderSrcDir, '*.{ts,js}');
  }

  return path.join(__dirname, sourceDirName, '*.{ts,js}');
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [
    resolveCompiledGlob('entities', 'entities'),
    // ApiKey — единственная сущность вне src/entities; без неё migration:generate
    // предложил бы удалить таблицу api_keys.
    resolveCompiledGlob('modules/api-keys/entities', 'modules/api-keys/entities'),
  ],
  migrations: [resolveCompiledGlob('migrations', 'migrations')],
  synchronize: false,
  logging: process.env.DB_QUERY_LOGGING === 'true',
});
