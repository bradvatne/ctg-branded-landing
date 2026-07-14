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

## One-shot upload (from the ctg-prod-ssh VM — has prod SSH auth)

```bash
./deploy-prod.sh
```

Uploads the static tree to `/tmp/ctg-branded-landing-src-<ts>` and lands three
`admin-run-*.sh` scripts in `/tmp` (deploy-watch posts each to Slack). Each
script stamps a fresh 14-day guard at upload.

## Kaiesh/root runs, in order

```bash
sudo bash /tmp/admin-run-branded-provision.sh                                   # once per box
sudo bash /tmp/admin-run-branded-activate.sh  /tmp/ctg-branded-landing-src-<ts> # populate current
sudo bash /tmp/admin-run-branded-cutover.sh                                     # THE live switch
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

Re-run `./deploy-prod.sh` then just `sudo bash /tmp/admin-run-branded-activate.sh <src>`
— once the branded vhost is live, activate health-checks the domain and rolls
back `current` on failure. No cutover needed again.
