# ctg-lead-capture — server-side booking lead capture → HubSpot

A Cloudflare Worker on `POST https://www.clubtechglobal.com/api/lead` that writes
every submitted booking-form lead to HubSpot **portal 242607066**, so a lead lands
**even if the visitor rejected cookies and never books a meeting**.

This is the **primary** capture. In `js/booking.js` it runs first; the existing
consent-gated pixel `identify()` and the HubSpot meetings booking stay as
secondary paths. If this endpoint fails, the scheduler still shows — the user is
never blocked.

## Why a Worker (not the origin)

The branded landing is a pure static site (no PHP, no `/api`). The prod zone
`clubtechglobal.com` is already fronted by Cloudflare, so a Worker route
intercepts `/api/lead` before it reaches the Apache origin. The Worker holds the
HubSpot private-app token as a secret — it is never in the repo or the browser.

## How it writes to HubSpot

1. **CRM contacts API (authoritative, uses the token):**
   `POST /crm/v3/objects/contacts`; on `409 Conflict` it extracts the existing
   contact id and `PATCH`es it (create-or-update by email). If the first attempt
   returns `400` (e.g. a portal missing the `message` property) it retries with
   default properties only, so the lead always lands.
   Host is `api.hubapi.com` — correct for the na2 region (the facade routes by
   the Hublet embedded in the `pat-na2-…` token).
2. **Forms Submissions API (optional, best-effort):** if `HUBSPOT_FORM_GUID` is
   set, it also submits to
   `/submissions/v3/integration/submit/242607066/{formGuid}` for native form
   reporting, workflow enrolment, and `hutk` de-anonymisation. Failures here are
   swallowed — the CRM write already captured the lead.

### Field mapping

| Form field    | HubSpot property                    |
|---------------|-------------------------------------|
| `firstname`   | `firstname`                         |
| `lastname`    | `lastname`                          |
| `company`     | `company`                           |
| `email`       | `email` (lower-cased, validated)    |
| `phone`       | `phone`                             |
| `description` | `message` (+ page/UTM source block) |

`page` and `utm_*` / click ids are folded into the `message` note (no custom
properties required) — and this is the only place UTM is captured for a
cookie-rejecting visitor, since GTM never fires for them.

## Hardening

- **Origin allow-list** — `www.clubtechglobal.com` + apex always allowed; extend
  with the `ALLOWED_ORIGINS` var. Cross-origin requests from other hosts get 403.
- **Honeypot** — hidden `company_url` field; if filled, request is accepted
  (200) but nothing is written.
- **Rate limit** — 5 submits / 60s / IP (per colo), via the `[[ratelimits]]`
  binding. Fails open if the binding is unavailable.
- **Email validation** and **field length caps** on every field.
- **No PII logged** — only HTTP status + HubSpot error category on failure.

## Deploy

```bash
cd workers/lead-capture
npm install              # or: npx wrangler --version
npx wrangler login       # once, as an account with the clubtechglobal.com zone

# Set the secret(s) — prompts for the value, stores it encrypted in Cloudflare:
npx wrangler secret put HUBSPOT_TOKEN
# optional, to also fire the native Forms API:
npx wrangler secret put HUBSPOT_FORM_GUID

npx wrangler deploy      # creates the Worker + the /api/lead routes
```

The Worker deploys independently of the static-site deploy (`deploy-prod.sh`);
it does not touch the Apache origin. Re-run `wrangler deploy` to ship changes.

### Secrets to set (Cloudflare, encrypted — never in the repo)

| Name               | Required | What it is                                                        |
|--------------------|----------|-------------------------------------------------------------------|
| `HUBSPOT_TOKEN`    | **Yes**  | HubSpot **private app** access token (`pat-na2-…`), portal 242607066. Scopes: `crm.objects.contacts.read` + `crm.objects.contacts.write`. |
| `HUBSPOT_FORM_GUID`| No       | GUID of a HubSpot form to also submit to (enables native form reporting). |

Non-secret config lives in `wrangler.toml [vars]` (`HUBSPOT_PORTAL_ID`,
`ALLOWED_ORIGINS`, optional host overrides).

### Create the HubSpot private app token

HubSpot → Settings → Integrations → **Private Apps** → Create → scopes
`crm.objects.contacts.write` and `crm.objects.contacts.read` → copy the
`pat-na2-…` token into `wrangler secret put HUBSPOT_TOKEN`.

## Test plan

**Local smoke (no prod zone needed):**
```bash
cp .dev.vars.example .dev.vars   # put a real HUBSPOT_TOKEN in it
npx wrangler dev
curl -sS -X POST http://localhost:8787/api/lead \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://www.clubtechglobal.com' \
  -d '{"firstname":"Test","lastname":"Lead","company":"QA Venue","email":"qa+worker@example.com","phone":"+62 812 000","description":"local worker test","page":"/book-a-demo/","utm_source":"curl"}'
# expect: {"ok":true}
```

**Prod — the exact acceptance scenario (cookies rejected, no booking):**
1. Deploy the Worker and `deploy-prod.sh` the site.
2. Open `https://www.clubtechglobal.com/book-a-demo/` in a fresh/incognito window.
3. In the cookie banner, click **Reject** (marketing + analytics denied — the
   pixel and GTM will NOT load).
4. Fill the form with a unique email (e.g. `qa+reject-YYYYMMDD@clubtechglobal.com`)
   and submit. Confirm the scheduler step appears. **Do not book a slot.** Close the tab.
5. In HubSpot (portal 242607066) → Contacts, search that email. **The contact
   should exist**, with firstname/lastname/company/phone set and the page/UTM in
   the Message property.
6. Negative checks:
   - Bad email (`foo@bar`) → response `400 invalid_email`, no contact.
   - Fill the hidden `company_url` field (via devtools) → response `200`, **no**
     contact created.
   - Rapid-fire 6+ POSTs from one IP within 60s → later ones return `429`.
   - POST with `Origin: https://evil.example` → `403 forbidden_origin`.
7. Watch live logs while testing: `npx wrangler tail` (status codes only — no PII).

**Re-submission:** submit again with the same email → the existing contact is
updated (409 → PATCH), not duplicated.
