# Production deploy — ctg-branded-landing → www.clubtechglobal.com

The branded landing site is **pure static** (no PHP, no `/api`, no DB). It goes
live on `www.clubtechglobal.com` via a **new, isolated docroot + a vhost swap**,
so the previous site (`ctg-landingpage`) stays intact on disk for instant
rollback.

## Layout on prod (`sgp1-marketing-prod01`)

```
/var/www/sites/ctg-branded-landing/
  releases/<stamp>/     ← each activated release (root:www-data, 755/644)
  current -> releases/<stamp>
  shared/logs/
/etc/apache2/sites-available/ctg-branded-landing-le-ssl.conf   ← ServerName www.clubtechglobal.com
```

TLS reuses the existing Cloudflare origin cert (`cf-star-clubtechglobal-com`,
wildcard). No cert changes.

## Routine redeploy — single-script protocol (from the Mac repo checkout)

```bash
./deploy-prod.sh --activate-only
```

The helper streams through the dedicated `ctg-prod-ssh` VM without putting the
repo or rendered scripts on that VM. It keeps an inspectable durable source at
`/home/brad/ctg-deploy/src/`, copies the reviewed tree to
`/tmp/ctg-branded-landing-src-<ts>`, and atomically lands one checksum-verified,
uniquely timestamped activation script in `/tmp`. Deploy-Watch posts that single
handoff to Slack. The script carries the exact GitHub commit and a fresh 14-day
guard.
The source contains `SHA256SUMS`; the uploader verifies it after transport and
the root activator verifies it again before creating a release.

Kaiesh/root runs the one printed command:

```bash
sudo bash /tmp/admin-run-branded-activate-<ts>.sh /tmp/ctg-branded-landing-src-<ts>
```

Activation copies the source into `releases/<stamp>`, flips `current`, checks
`/` and `/book-a-demo/`, and automatically restores the previous `current`
target if either health check fails.

## First-time setup or full vhost rebuild only

```bash
./deploy-prod.sh --initial
```

This explicitly lands the original three-step queue:

```bash
sudo bash /tmp/admin-run-branded-provision-<ts>.sh
sudo bash /tmp/admin-run-branded-activate-<ts>.sh /tmp/ctg-branded-landing-src-<ts>
sudo bash /tmp/admin-run-branded-cutover-<ts>.sh
```

Do not use `--initial` for a routine content or frontend release.

- **provision** — creates the docroot + writes the vhost **disabled**. No live change.
- **activate** — copies the source into `releases/<stamp>`, strips non-runtime
  files, flips `current`. Pre-cutover the vhost is disabled, so this is invisible.
- **cutover** — `a2ensite` branded + `a2dissite ctg-landingpage`, reload,
  health-checks `/`, `/book-a-demo/`, and the `/pricing/`→`/book-a-demo/` 301,
  and **auto-reverts the vhost swap** on any failure. Then purges Cloudflare.

## Rollback (after cutover)

```bash
sudo a2dissite ctg-branded-landing-le-ssl && sudo a2ensite ctg-landingpage-le-ssl && sudo systemctl reload apache2
```

The old docroot is untouched, so this is instant.

## Re-deploys (after cutover)

Re-run `./deploy-prod.sh` then just `sudo bash /tmp/admin-run-branded-activate-<ts>.sh <src>`
— once the branded vhost is live, activate health-checks the domain and rolls
back `current` on failure. No cutover needed again.
