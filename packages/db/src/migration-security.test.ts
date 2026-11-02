import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('SQL Migration Security Checks', () => {
  const migrationsDir = path.resolve(__dirname, '../migrations');

  it('ensures no SQL migration file contains hardcoded role passwords', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);

    const passwordLiteralRegex = /(?:CREATE|ALTER)\s+ROLE\s+[a-zA-Z0-9_]+\s+.*PASSWORD\s+'[^']+'/i;

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');

      const match = passwordLiteralRegex.exec(sql);
      expect(
        match,
        `Found hardcoded password literal in migration ${file}: "${match?.[0]}"`,
      ).toBeNull();
    }
  });

  it('ensures migration 0002 creates app_user role without password and with safe attributes', () => {
    const migration0002 = path.join(migrationsDir, '0002_enable_row_level_security.sql');
    const sql = fs.readFileSync(migration0002, 'utf8');

    // Role creation must NOT specify PASSWORD
    expect(sql).not.toContain('app_user_secure_password');
    expect(sql).not.toMatch(/CREATE\s+ROLE\s+app_user\s+.*PASSWORD/i);

    // Role creation must specify safe non-bypass attributes
    expect(sql).toContain('CREATE ROLE app_user WITH LOGIN NOBYPASSRLS NOSUPERUSER');

    // FORCE RLS must be specified for all core tables
    const tenantTables = [
      'documents',
      'chunks',
      'conversations',
      'messages',
      'audit_log',
      'feedback',
    ];
    for (const table of tenantTables) {
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    }
  });
});
