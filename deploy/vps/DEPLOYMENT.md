# IFA VPS deployment

Repository: https://github.com/lxlbxl/ifa.ng
Checkout: /root/ifa-app
Public URLs: https://ifa.ng and https://www.ifa.ng

All application processes run in Docker: web (React build in nginx), API, PostgREST, recording worker, and dedicated PostgreSQL 16.
Traefik supplies TLS and HTTP redirects. The frontend proxies the API on the same origin, including /api/auth, /v1, /rest/v1, /webhooks, /files, and /health.
PostgreSQL has a persistent named volume and no published host port. Runtime database users have limited roles; migrations use the admin connection.

Storage uses the existing ai20-minio Docker container at http://ai20-minio:9000, with private bucket ifa-files and a bucket-scoped user. No public bucket policy is configured. API file access remains authenticated or signed by the application.

Secrets are in deploy/vps/.env (mode 0600, ignored by Git and Docker builds). No provider keys were supplied for payments, SMTP, Google Meet, Agora, WhatsApp/SMS or AI transcription. Those integrations require their own credentials before use. This is a fresh database deployment, not an import of any prior hosted database.

Deploy/update:

    docker compose -f /root/ifa-app/deploy/vps/compose.yml up -d --build

Status/logs:

    docker compose -f /root/ifa-app/deploy/vps/compose.yml ps
    docker compose -f /root/ifa-app/deploy/vps/compose.yml logs --tail 100 api

The previous coming soon container is stopped and retained for rollback. To restore it, stop the new web service and start ifa-ng-coming-soon.


## First installation

The VPS must already have Docker Compose, Traefik on the external `coolify` Docker network, and `ai20-minio` attached to that network. Point DNS for the apex domain and `www` to this VPS; if using Cloudflare proxy, use Full (strict) TLS. Copy `.env.example` to `.env`, set unique database passwords and auth/JWT secrets, and make sure `DATABASE_URL`, `MIGRATE_DATABASE_URL`, and the PostgREST JWT secret use the matching values. Set `API_URL`, `APP_URL`, `CORS_ORIGINS`, and `COOKIE_DOMAIN` to the actual site domains. Set `S3_ACCESS_KEY_ID` to the dedicated MinIO username and `S3_SECRET_ACCESS_KEY` to its secret; both `.env.example` values are placeholders. Keep `.env` mode 0600.

Create private MinIO bucket `ifa-files` and a dedicated user, then attach the policy from `bucket-policy.json` to that user. The application credentials must not be MinIO root credentials. Start the compose stack with the command above; the API applies database migrations automatically.

## Web push notifications (VAPID)

Push while the app is closed requires a VAPID key pair. Generate a **unique pair for each environment** after the API image has been built:

```sh
docker compose -f compose.yml run --rm --no-deps --entrypoint node api \
  -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

Copy the resulting `publicKey` and `privateKey` into `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env`; set `VAPID_SUBJECT` to a monitored `mailto:` address or an HTTPS contact URL. Keep the private key secret, keep `.env` mode 0600, and never commit or expose it. Do not rotate the pair casually: existing browser subscriptions are tied to the public key and users would need to subscribe again after a rotation.

Restart the API after editing `.env` so it receives the new values:

```sh
docker compose -f compose.yml up -d --force-recreate api
```

Verify `GET https://<domain>/v1/push/config` returns the public key and Admin → Settings → Integrations reports Web push as configured. Then enable notifications in a supported browser and confirm its subscription was registered. If browser permission was granted before VAPID was configured, return to Settings and select **Finish setup on this device**; permission alone does not create a push subscription. Without VAPID keys the app can only play alerts while open.

## Seed accounts and profile portraits

`run-demo-seed.sh` creates private random credentials and generated seed assets with `prepare-demo.py` (requires Python 3, Pillow and DejaVu Sans fonts), then runs `seed-demo.mjs` inside the API container. Credentials are saved in `demo-credentials.json` and `DEMO-ACCESS.md`, both excluded from Git and build contexts. All fixture financial entries are fictional. The seed exits without changing account data or balances when its audit marker already exists.

To install the profile appearance used on this deployment, run `python3 prepare-profile-portraits.py` to download the stock portraits, then:

```sh
cd /root/ifa-app/deploy/vps
api_container=$(docker compose -f compose.yml ps -q api)
docker cp profile-portraits "$api_container":/tmp/ifa-profile-portraits
docker cp update-profile-portraits.mjs "$api_container":/app/server/update-profile-portraits.mjs
docker exec "$api_container" node update-profile-portraits.mjs
```

This updates profile display names, removes their visible demo tags and serves the portraits through the private MinIO-backed API. The reserved test email addresses and financial fixture markers are preserved. Generated media, credentials, database dumps and logs are intentionally kept outside Git.

`node check-demo.mjs` checks fixture logins, row access, signed recording access, notes and avatars against the public deployment. It spaces logins to respect production rate limits. The completed deployment checks also confirmed public search displays the three approved seeded practitioners.

## Backups

The `backup` service dumps the database every night at `BACKUP_HOUR` (UTC), checks the dump can be read, and keeps `BACKUP_KEEP_LOCAL` days in the `backups` volume. Set `RCLONE_REMOTE` and the `BACKUP_S3_*` values in `.env` to also copy each dump to a bucket off this server (keep `BACKUP_KEEP_REMOTE` days there). Without it, a lost server means lost data.

```sh
# Take one backup now
docker compose -f compose.yml run --rm -e BACKUP_ONCE=1 backup
# List backups
docker compose -f compose.yml run --rm --entrypoint ls backup -lh /backups
# Check a backup restores (into a scratch database, production untouched)
docker compose -f compose.yml run --rm --entrypoint restore.sh backup /backups/ifa-<timestamp>.dump
```

Uploaded files (avatars, recordings) live in MinIO; back up its bucket with your MinIO/S3 tooling.

## Before real people use it

1. Remove the demo accounts and their fictional sessions and money (including the demo admin, which signs in with a password):
   ```sh
   docker compose -f compose.yml exec -T db psql -U ifa_admin -d ifa -v ON_ERROR_STOP=1 < remove-demo.sql
   rm -f demo-credentials.json DEMO-ACCESS.md
   ```
2. Configure the integrations the launch needs in `.env`: Paystack or Flutterwave for payments; Termii for production phone sign-in codes; SMTP for email; WhatsApp credentials for WhatsApp delivery; Google service account and organizer email for Meet links; and Agora credentials for video fallback. Configure VAPID as described above for push while the app is closed. Set up each provider's matching webhook/callback URL in its provider dashboard. Admin → Settings → Integrations reports which server-side integrations are present.
3. Strongly recommended: set `RCLONE_REMOTE` and the `BACKUP_S3_*` values to copy database dumps off the VPS, and arrange backups for the MinIO `ifa-files` bucket too.
4. Optional error tracking: set `SENTRY_DSN` (API) and `VITE_SENTRY_DSN` (web) in `.env`, then rebuild. Add the Sentry ingest host to `connect-src` in `security-headers.conf` when the CSP is enforced.
5. Prices for the diaspora: put the site behind Cloudflare's proxy and set `GEO_COUNTRY_HEADER=cf-ipcountry`, so visitors outside Nigeria see US dollar prices. Without it, only the phone number decides (a +234 number pays naira). Dollar prices, the naira rate and per-Babalawo dollar prices are in Admin → Settings → Diaspora prices and on each Babalawo's record. Dollar payments go through Flutterwave, so enable USD collections on the Flutterwave account.
6. Set `VITE_SUPPORT_EMAIL` and `VITE_SUPPORT_WHATSAPP` (international format without +) in `.env` for the Help page and footer, then rebuild the web app.
7. Have the Terms, Privacy and Refund pages (`/terms`, `/privacy`, `/refunds`, in `src/pages/Legal.tsx`) reviewed. Confirm the main site, `www`, `/health`, phone sign-in, a test payment, file upload, and any enabled notification/video providers before launch.

## Provider keys from the admin screen

Admin → Settings → Integrations lets an admin enter, replace and test every provider key
(Paystack, Flutterwave, Google Meet, Agora, Termii, WhatsApp, SMTP, VAPID, storage, OpenAI,
Anthropic, Sentry). A value saved there overrides the same name in `.env` at once, without a
restart; "Use server value" goes back to `.env`. Values are encrypted with
`SETTINGS_ENCRYPTION_KEY` (or, if unset, a key derived from `AUTH_SECRET`) and stored in
`private.integration_secrets`, which PostgREST does not serve. The API and the recording worker
must share the same key. If that key changes, re-enter the saved values. Saves and tests are
recorded in the admin activity log, without the values.
