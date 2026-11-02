-- ─── Level 2: PostgreSQL Row-Level Security (RLS) & Tenant Isolation ───────────

-- 1. Create non-owner, non-BYPASSRLS application role 'app_user'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_secure_password';
  END IF;
END
$$;

-- 2. Grant permissions to app_user on public schema
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

-- 3. Enable and Force Row-Level Security on tenant-scoped tables
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "chunks" FORCE ROW LEVEL SECURITY;
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
ALTER TABLE "feedback" FORCE ROW LEVEL SECURITY;

-- 4. Create Tenant Isolation Policies (app.tenant_id must match tenant_id)
-- Using NULLIF(..., '')::uuid so if app.tenant_id is unconfigured or empty, it evaluates to NULL = tenant_id -> FALSE (0 rows returned)

DROP POLICY IF EXISTS tenant_isolation_documents ON "documents";
CREATE POLICY tenant_isolation_documents ON "documents"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_chunks ON "chunks";
CREATE POLICY tenant_isolation_chunks ON "chunks"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_conversations ON "conversations";
CREATE POLICY tenant_isolation_conversations ON "conversations"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_messages ON "messages";
CREATE POLICY tenant_isolation_messages ON "messages"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_audit_log ON "audit_log";
CREATE POLICY tenant_isolation_audit_log ON "audit_log"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_feedback ON "feedback";
CREATE POLICY tenant_isolation_feedback ON "feedback"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
