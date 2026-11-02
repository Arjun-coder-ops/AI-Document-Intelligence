import React from 'react';
import { Shield, Lock, Database, KeyRound } from 'lucide-react';
import { SectionHeader } from './SectionHeader.js';

export const SecuritySection: React.FC = () => {
  const securityPillars = [
    {
      icon: Database,
      title: 'PostgreSQL Row Level Security (RLS)',
      desc: 'All 6 tenant tables have FORCE ROW LEVEL SECURITY enabled. Database roles cannot bypass policies.',
      code: "CREATE POLICY tenant_isolation_policy ON documents FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);",
    },
    {
      icon: Lock,
      title: 'Transaction-Local Session Scope',
      desc: 'Safe with Neon PgBouncer transaction-mode pooling. Resets automatically upon transaction commit.',
      code: 'await client.query("SELECT set_config(\'app.tenant_id\', $1, true)", [tenantId]);',
    },
    {
      icon: KeyRound,
      title: 'Enterprise Cryptography & CSRF',
      desc: 'Argon2id password hashing, HTTP-only secure samesite cookies, and double-submit CSRF tokens.',
      code: 'app.use(csrfProtection); // Rejects state-changing requests lacking valid X-CSRF-Token',
    },
  ];

  return (
    <section style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <SectionHeader
        badgeIcon={<Shield size={13} />}
        badgeText="Enterprise Defense-in-Depth"
        title="Zero-Trust Multi-Tenant Isolation"
        description="Hardware and database-enforced boundaries eliminate cross-tenant data leakage risks."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {securityPillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <div
              key={idx}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '28px',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '18px',
                  }}
                >
                  <Icon size={20} />
                </div>
                <h3 className="font-serif" style={{ fontSize: '1.25rem', marginBottom: '10px' }}>
                  {pillar.title}
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    marginBottom: '18px',
                  }}
                >
                  {pillar.desc}
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                }}
              >
                <code>{pillar.code}</code>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
