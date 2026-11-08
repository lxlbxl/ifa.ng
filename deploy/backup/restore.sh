#!/bin/sh
# Restore a backup into a database (default: a scratch database, so you can
# check it without touching production).
#   restore.sh /backups/ifa-20261108T020000Z.dump [target_db]
set -eu
file="$1"; target="${2:-ifa_restore_check}"
[ -f "$file.sha256" ] && sha256sum -c "$file.sha256"
psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $target WITH (FORCE)" -c "CREATE DATABASE $target"
pg_restore --no-owner --exit-on-error --dbname="$target" "$file"
psql -d "$target" -Atc "select count(*) || ' migrations recorded' from public.schema_migrations"
echo "[restore] restored $file into $target"
