#!/bin/sh
set -eu
: "${COMMERCE_RUNTIME_PASSWORD:?Missing commerce runtime password}"
: "${AI_RUNTIME_PASSWORD:?Missing AI runtime password}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
    --set=commerce_runtime_password="$COMMERCE_RUNTIME_PASSWORD" --set=ai_runtime_password="$AI_RUNTIME_PASSWORD" \
    --set=database_name="$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE commerce_runtime LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='commerce_runtime') \gexec
SELECT 'CREATE ROLE ai_runtime LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ai_runtime') \gexec
SELECT format('ALTER ROLE commerce_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'commerce_runtime_password') \gexec
SELECT format('ALTER ROLE ai_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'ai_runtime_password') \gexec
GRANT CONNECT ON DATABASE :"database_name" TO commerce_runtime, ai_runtime;
REVOKE ALL ON SCHEMA commerce, ai, public FROM commerce_runtime, ai_runtime;
GRANT USAGE ON SCHEMA commerce TO commerce_runtime;
GRANT USAGE ON SCHEMA ai TO ai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA commerce TO commerce_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ai TO ai_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA commerce TO commerce_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ai TO ai_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE commerce_app IN SCHEMA commerce GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commerce_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_app IN SCHEMA ai GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ai_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE commerce_app IN SCHEMA commerce GRANT USAGE, SELECT ON SEQUENCES TO commerce_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_app IN SCHEMA ai GRANT USAGE, SELECT ON SEQUENCES TO ai_runtime;
REVOKE ALL ON commerce."__EFMigrationsHistory" FROM commerce_runtime;
REVOKE ALL ON ai.alembic_version FROM ai_runtime;
REVOKE UPDATE, DELETE ON commerce."StockMovements", commerce."OrderStatusChanges" FROM commerce_runtime;
ALTER ROLE commerce_runtime SET search_path=commerce;
ALTER ROLE ai_runtime SET search_path=ai;
SQL
