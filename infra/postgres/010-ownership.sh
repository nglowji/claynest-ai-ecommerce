#!/bin/sh
set -eu
: "${COMMERCE_DB_PASSWORD:?COMMERCE_DB_PASSWORD is required}"
: "${AI_DB_PASSWORD:?AI_DB_PASSWORD is required}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=commerce_password="$COMMERCE_DB_PASSWORD" --set=ai_password="$AI_DB_PASSWORD" \
  --set=database_name="$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE commerce_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'commerce_app') \gexec
SELECT 'CREATE ROLE ai_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_app') \gexec
SELECT format('ALTER ROLE commerce_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'commerce_password') \gexec
SELECT format('ALTER ROLE ai_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'ai_password') \gexec
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO commerce_app, ai_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS commerce AUTHORIZATION commerce_app;
CREATE SCHEMA IF NOT EXISTS ai AUTHORIZATION ai_app;
REVOKE ALL ON SCHEMA commerce FROM PUBLIC, ai_app;
REVOKE ALL ON SCHEMA ai FROM PUBLIC, commerce_app;
ALTER ROLE commerce_app SET search_path = commerce;
ALTER ROLE ai_app SET search_path = ai;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA ai;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector' AND n.nspname <> 'ai') THEN
        ALTER EXTENSION vector SET SCHEMA ai;
    END IF;
END $$;
SQL
