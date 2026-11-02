import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { directDb, directPool } from './client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.info('Applying database migrations using direct connection...');
  const client = await directPool.connect();

  try {
    // Ensure pgvector extension exists before running schema migrations
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.info('✓ pgvector extension verified');

    // Run drizzle migrations
    const migrationsFolder = path.resolve(__dirname, '../migrations');
    await migrate(directDb, { migrationsFolder });
    console.info('✓ Drizzle migrations applied successfully');
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
