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

## One-shot upload (from the Mac repo checkout)

```bash
./deploy-prod.sh
```

The helper streams through the dedicated `ctg-prod-ssh` VM without putting the
repo or rendered scripts on that VM. It keeps an inspectable durable source at
`/home/brad/ctg-deploy/src/`, copies the reviewed tree to
`/tmp/ctg-branded-landing-src-<ts>`, and atomically lands three checksum-verified
uniquely timestamped `admin-run-*.sh` scripts in `/tmp` (Deploy-Watch posts each
fresh queue to Slack instead of confusing it with an older filename). Each
script carries the exact GitHub commit, ordered next-step instructions, and a
fresh 14-day guard.
The source contains `SHA256SUMS`; the uploader verifies it after transport and
the root activator verifies it again before creating a release.

Before landing a new queue, remove only obsolete pending handoffs and branded
payloads (never system scripts or root-owned logs):

```bash
find /tmp -maxdepth 1 -user brad -type f -name 'admin-run-*.sh' -delete
find /tmp -maxdepth 1 -user brad -type d -name 'ctg-branded-landing-src-*' -exec rm -rf -- {} +
```

## Kaiesh/root runs, in order

```bash
sudo bash /tmp/admin-run-branded-provision-<ts>.sh                                   # once per box
sudo bash /tmp/admin-run-branded-activate-<ts>.sh /tmp/ctg-branded-landing-src-<ts>  # populate current
sudo bash /tmp/admin-run-branded-cutover-<ts>.sh                                     # THE live switch
```

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
