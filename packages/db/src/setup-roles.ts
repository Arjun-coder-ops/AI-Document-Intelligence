import { directPool } from './client.js';

/**
 * One-time role setup script run with DATABASE_URL_DIRECT (database owner privileges).
 * Parses the application user credentials from DATABASE_URL and configures the role
 * via ALTER ROLE with NOBYPASSRLS and NOSUPERUSER.
 */
export async function setupRoles(): Promise<{ role: string; success: boolean }> {
  const appDbUrl = process.env['DATABASE_URL'];
  if (!appDbUrl) {
    throw new Error(
      '[db:setup-roles] DATABASE_URL environment variable is required to configure app_user credentials.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(appDbUrl);
  } catch (err) {
    throw new Error(
      `[db:setup-roles] Failed to parse DATABASE_URL: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const rawUser = decodeURIComponent(parsed.username || 'app_user');
  const password = decodeURIComponent(parsed.password || '');

  if (!password) {
    throw new Error(
      '[db:setup-roles] DATABASE_URL does not contain a password for role configuration.',
    );
  }

  // Use the username from DATABASE_URL if it is an app role (not superuser/postgres), else default to 'app_user'
  const targetRole = rawUser && rawUser !== 'postgres' ? rawUser : 'app_user';

  // Identifier safety check: Postgres identifiers must match safe regex
  if (!/^[a-zA-Z0-9_]+$/.test(targetRole)) {
    throw new Error(`[db:setup-roles] Invalid role identifier: "${targetRole}"`);
  }

  const client = await directPool.connect();
  try {
    const escapedPassword = password.replace(/'/g, "''");

    // Ensure role exists without password first
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${targetRole}') THEN
          CREATE ROLE "${targetRole}" WITH LOGIN NOBYPASSRLS NOSUPERUSER;
        END IF;
      END
      $$;
    `);

    // Set password safely via direct ALTER ROLE and enforce strict RLS constraints
    await client.query(
      `ALTER ROLE "${targetRole}" WITH LOGIN PASSWORD '${escapedPassword}' NOBYPASSRLS NOSUPERUSER;`,
    );

    // Ensure schema and sequence permissions
    await client.query(`GRANT USAGE ON SCHEMA public TO "${targetRole}";`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${targetRole}";`);
    await client.query(
      `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${targetRole}";`,
    );

    console.info(
      `[db:setup-roles] Successfully configured role "${targetRole}" (NOBYPASSRLS, NOSUPERUSER) from DATABASE_URL.`,
    );
    return { role: targetRole, success: true };
  } finally {
    client.release();
  }
}

// Allow direct execution via CLI (node dist/setup-roles.js)
if (
  process.argv[1] &&
  (process.argv[1].endsWith('setup-roles.js') || process.argv[1].endsWith('setup-roles.ts'))
) {
  setupRoles()
    .then(async () => {
      await directPool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[db:setup-roles] Failed:', err);
      await directPool.end();
      process.exit(1);
    });
}
