# Running IFA.ng on your own VPS

One server runs everything: Postgres 16, the API, Caddy (HTTPS) and a nightly
backup job that copies each backup off the server. Postgres is never exposed
to the internet; only ports 22, 80 and 443 are open.

## 1. The server

- Ubuntu 24.04 LTS, 2 vCPU, 4 GB RAM, 80 GB SSD is plenty at current scale.
  London or Frankfurt gives the best latency to Nigeria among common providers
  (Hetzner, DigitalOcean, Vultr, Linode, OVH all work).
- Point DNS: an `A` record for `api.ifa.ng` to the server's IP.

```sh
# as root, once
apt update && apt -y upgrade
apt -y install ufw unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades          # automatic security updates
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80 && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
curl -fsSL https://get.docker.com | sh
adduser --disabled-password deploy && usermod -aG docker deploy
# copy your SSH key to /home/deploy/.ssh/authorized_keys, then in
# /etc/ssh/sshd_config set: PasswordAuthentication no, PermitRootLogin no
systemctl restart ssh
```

## 2. Offsite backup bucket

Backups that live only on the VPS die with the VPS. Create a private bucket
(Cloudflare R2 `ifa-backups` is assumed; any S3-compatible store works) and an
access key limited to that bucket. Put the key in `.env` below.

## 3. First start

```sh
# as deploy
git clone https://github.com/lxlbxl/ifa.ng && cd ifa.ng/deploy
cp .env.example .env && nano .env      # domain, two strong passwords, R2 keys
chmod 600 .env
docker compose up -d --build
docker compose ps                      # db, api healthy; caddy, backup up
curl https://api.ifa.ng/health         # {"ok":true,"db":"up"}
```

The API container applies any new migrations from `db/` each time it starts.

## 4. Deploying an update

```sh
cd ~/ifa.ng && git pull && cd deploy && docker compose up -d --build api
```

## 5. Backups

- Automatic: every night at `BACKUP_HOUR` (UTC). Each dump is checked as
  readable, checksummed, copied to `RCLONE_REMOTE`, kept 7 days on the server
  and 30 days offsite.
- Take one now: `docker compose exec -e BACKUP_ONCE=1 backup backup.sh`
- **Test a restore monthly** (restores into a scratch database, production untouched):
  `docker compose exec backup restore.sh /backups/<file>.dump`
- Full disaster recovery onto a new server: do steps 1 to 3, then
  `rclone copy r2:ifa-backups/<file>.dump ./backups/` and
  `docker compose exec backup restore.sh /backups/<file>.dump ifa`
  (restore into a freshly created, empty `ifa` database).

Nightly dumps mean up to 24 hours of data could be lost in a total server
loss. When booking and payment volume grows, add continuous WAL archiving
(pgBackRest or WAL-G to the same bucket) to get that down to minutes.

## 6. Monitoring

- Add an uptime check on `https://api.ifa.ng/health` (Sentry Uptime, UptimeRobot
  or Better Stack) that alerts on anything but `200`.
- `docker compose logs -f api` for the API, `docker compose logs backup` to
  confirm last night's backup.
- Watch disk: `df -h` and `docker system df`.

## 7. Postgres upgrades

Minor versions: `docker compose pull db && docker compose up -d db`.
Major versions (16 to 17): take a backup, start a new `postgres:17` volume, and
restore the dump into it, as in disaster recovery. Never just change the image
tag on an existing data volume.
