#!/bin/sh
# Runs once, when the Postgres data volume is first created.
# Creates the API's runtime login: not a superuser, owns nothing, and can only
# switch into anon / authenticated / service_role (granted after migrations).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v api_password="$API_DB_PASSWORD" <<'SQL'
CREATE ROLE ifa_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'api_password';
GRANT CONNECT ON DATABASE ifa TO ifa_api;
SQL
