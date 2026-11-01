import { defineConfig } from 'drizzle-kit';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: path.resolve(__dirname, './src/schema/index.ts'),
  out: path.resolve(__dirname, './migrations'),
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env['DATABASE_URL_DIRECT'] ??
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/docsage',
  },
  verbose: true,
  strict: true,
});
