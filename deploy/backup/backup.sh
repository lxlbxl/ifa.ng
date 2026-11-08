#!/bin/sh
# Nightly logical backup, kept on the box and copied off it.
#
#   BACKUP_HOUR          hour of day (UTC) to run, default 2
#   BACKUP_KEEP_LOCAL    days kept on the VPS, default 7
#   BACKUP_KEEP_REMOTE   days kept offsite, default 30
#   RCLONE_REMOTE        e.g. "r2:ifa-backups" (configure rclone via RCLONE_CONFIG_* env)
#                        leave empty to keep local copies only (not recommended)
#   BACKUP_ONCE=1        take one backup now and exit (used by the runbook)
set -eu
: "${BACKUP_HOUR:=2}" "${BACKUP_KEEP_LOCAL:=7}" "${BACKUP_KEEP_REMOTE:=30}" "${RCLONE_REMOTE:=}"
DIR=/backups
mkdir -p "$DIR"

run_backup() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  file="$DIR/ifa-$ts.dump"
  echo "[backup] starting $file"
  pg_dump --format=custom --compress=9 --no-owner --file="$file.partial"
  # Prove the archive is readable before we trust it.
  pg_restore --list "$file.partial" >/dev/null
  mv "$file.partial" "$file"
  sha256sum "$file" > "$file.sha256"
  echo "[backup] wrote $(du -h "$file" | cut -f1)"
  if [ -n "$RCLONE_REMOTE" ]; then
    rclone copy "$file" "$RCLONE_REMOTE/" && rclone copy "$file.sha256" "$RCLONE_REMOTE/"
    rclone delete --min-age "${BACKUP_KEEP_REMOTE}d" "$RCLONE_REMOTE/"
    echo "[backup] copied offsite to $RCLONE_REMOTE"
  else
    echo "[backup] WARNING: RCLONE_REMOTE not set, backup is on this server only"
  fi
  find "$DIR" -name 'ifa-*' -mtime +"$BACKUP_KEEP_LOCAL" -delete
}

if [ "${BACKUP_ONCE:-0}" = "1" ]; then run_backup; exit 0; fi

echo "[backup] scheduler up, runs daily at ${BACKUP_HOUR}:00 UTC"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "@$(( now - now % 86400 + BACKUP_HOUR * 3600 ))" +%s 2>/dev/null || echo $(( now - now % 86400 + BACKUP_HOUR * 3600 )))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  sleep $(( next - now ))
  run_backup || echo "[backup] FAILED at $(date -u)"
done
