-- PVG AI development database bootstrap
-- Creates application role subject to RLS. Migrator is the superuser-equivalent owner from POSTGRES_USER.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvg_app') THEN
    CREATE ROLE pvg_app LOGIN PASSWORD 'pvg_dev_change_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pvg TO pvg_app;
GRANT USAGE ON SCHEMA public TO pvg_app;

-- Default privileges for objects created by migrator
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pvg_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pvg_app;
