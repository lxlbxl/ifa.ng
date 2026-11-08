#!/bin/sh
# Runs once, when the Postgres data volume is first created.
# Creates the API's runtime login: not a superuser, owns nothing, and can only
# switch into anon / authenticated / service_role (granted after migrations).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v api_password="$API_DB_PASSWORD" -v rest_password="$REST_DB_PASSWORD" <<'SQL'
CREATE ROLE ifa_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'api_password';
GRANT CONNECT ON DATABASE ifa TO ifa_api;
-- PostgREST's login. It can only become anon or authenticated (never service_role),
-- chosen per request from the signed token the API hands to the web app.
CREATE ROLE ifa_rest LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'rest_password';
GRANT CONNECT ON DATABASE ifa TO ifa_rest;
SQL
