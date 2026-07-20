/* ──────────────────────────────────────────────────────────────────────
   Clubtech lead-capture Worker — POST /api/lead

   Guarantees that a lead submitted on the booking form ALWAYS lands in
   HubSpot, independent of cookie consent and independent of whether the
   visitor completes the meeting booking. This is the server-side capture
   the static site cannot do on its own; the consent-gated pixel and the
   HubSpot meetings booking remain SECONDARY paths in booking.js.

   Deployed as a Cloudflare Worker on the route:
     www.clubtechglobal.com/api/lead   (zone already fronted by Cloudflare)

   Auth: a HubSpot PRIVATE APP token in the Cloudflare secret HUBSPOT_TOKEN.
   Never committed, never sent to the browser. Portal 242607066 (region na2 —
   the api.hubapi.com facade routes by the Hublet embedded in the token, so no
   regional host is needed).

   Hardening: origin allow-list, honeypot, per-colo rate limit, email
   validation, field length caps. No PII is ever logged.
   ────────────────────────────────────────────────────────────────────── */

const DEFAULT_ALLOWED = ['www.clubtechglobal.com', 'clubtechglobal.com'];
const UTM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORE_PROPS = ['email', 'firstname', 'lastname', 'phone', 'company'];

/* ── helpers ─────────────────────────────────────────────────────────── */

function allowedHosts(env) {
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => {
      try { return new URL(o).hostname; }
      catch (_) { return o.replace(/^https?:\/\//, '').split('/')[0]; }
    });
  return new Set([...DEFAULT_ALLOWED, ...extra]);
}

function originAllowed(origin, env) {
  if (!origin) return true; // same-origin fetch / non-browser client — other guards still apply
  let host;
  try { host = new URL(origin).hostname; } catch (_) { return false; }
  return allowedHosts(env).has(host);
}

function corsHeaders(origin, env) {
  const h = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && originAllowed(origin, env)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(status, obj, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      extra || {}
    ),
  });
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

/* ── request handler ─────────────────────────────────────────────────── */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, cors);
    if (origin && !originAllowed(origin, env)) return json(403, { ok: false, error: 'forbidden_origin' }, cors);

    let body;
    try { body = await request.json(); }
    catch (_) { return json(400, { ok: false, error: 'bad_json' }, cors); }
    if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'bad_json' }, cors);

    // Honeypot — bots fill the hidden field; humans never see it. Accept the
    // request (so the bot gets no signal) but write nothing to HubSpot.
    if (clean(body.company_url, 200)) return json(200, { ok: true }, cors);

    const email = clean(body.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'invalid_email' }, cors);

    // Best-effort per-colo rate limit — one IP can't flood the endpoint.
    if (env.LEAD_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      try {
        const { success } = await env.LEAD_LIMITER.limit({ key: ip });
        if (!success) return json(429, { ok: false, error: 'rate_limited' }, cors);
      } catch (_) { /* limiter unavailable — fail open, don't lose the lead */ }
    }

    const firstname = clean(body.firstname, 100);
    const lastname = clean(body.lastname, 100);
    const company = clean(body.company, 200);
    const phone = clean(body.phone, 40);
    const description = clean(body.description, 5000);
    const page = clean(body.page, 300);

    // Fold page + UTM attribution into the notes field. No custom properties
    // required, so it lands on any portal — and it's the ONLY place UTM is
    // captured for a visitor who rejected cookies (GTM never fires for them).
    const src = [];
    if (page) src.push('Page: ' + page);
    for (const k of UTM_KEYS) { const v = clean(body[k], 200); if (v) src.push(k + ': ' + v); }
    let message = description;
    if (src.length) message = (message ? message + '\n\n' : '') + '— via clubtechglobal.com —\n' + src.join('\n');
    message = message.slice(0, 6000);

    const properties = { email };
    if (firstname) properties.firstname = firstname;
    if (lastname) properties.lastname = lastname;
    if (company) properties.company = company;
    if (phone) properties.phone = phone;
    if (message) properties.message = message;

    // PRIMARY, authoritative write: CRM create-or-update via the private-app token.
    let res = await upsertContact(env, properties);
    if (res.status === 400) {
      // A non-default property (e.g. `message`) may be missing on the portal.
      // Retry with guaranteed-default props only, so the lead still lands.
      const core = {};
      for (const k of CORE_PROPS) if (properties[k]) core[k] = properties[k];
      core.email = email;
      res = await upsertContact(env, core);
    }

    // OPTIONAL secondary: register a native HubSpot form submission too (form
    // reporting, workflow enrolment, hutk de-anonymisation). Only when a form
    // GUID is configured; best-effort, never blocks or fails the response.
    if (env.HUBSPOT_FORM_GUID) {
      ctx.waitUntil(
        submitForm(env, { email, firstname, lastname, company, phone, description, page, body })
          .catch(() => {})
      );
    }

    if (res.ok) return json(200, { ok: true }, cors);

    // Never log PII — status + HubSpot error category only.
    let category = '';
    try { category = ((await res.clone().json()) || {}).category || ''; } catch (_) {}
    console.warn('lead: hubspot write failed', res.status, category);
    return json(502, { ok: false, error: 'crm_unavailable' }, cors);
  },
};

/* ── HubSpot CRM: create, or update-by-id on conflict ────────────────── */

async function upsertContact(env, properties) {
  const base = env.HUBSPOT_API_BASE || 'https://api.hubapi.com';
  const headers = {
    Authorization: 'Bearer ' + env.HUBSPOT_TOKEN,
    'Content-Type': 'application/json',
  };
  const payload = JSON.stringify({ properties });

  let res = await fetch(base + '/crm/v3/objects/contacts', { method: 'POST', headers, body: payload });
  if (res.status !== 409) return res;

  // Contact exists — HubSpot returns "...Existing ID: 12345". Update it.
  let id = '';
  try { id = (((await res.clone().text()).match(/Existing ID:\s*(\d+)/i)) || [])[1] || ''; } catch (_) {}
  if (!id) return res;
  return fetch(base + '/crm/v3/objects/contacts/' + id, { method: 'PATCH', headers, body: payload });
}

/* ── HubSpot Forms Submissions API (optional, best-effort) ───────────── */

async function submitForm(env, d) {
  const portal = env.HUBSPOT_PORTAL_ID || '242607066';
  const host = env.HUBSPOT_FORMS_HOST || 'https://api.hsforms.com';
  const fields = [];
  const add = (name, value) => { if (value) fields.push({ name, value }); };
  add('email', d.email);
  add('firstname', d.firstname);
  add('lastname', d.lastname);
  add('company', d.company);
  add('phone', d.phone);
  add('message', d.description);
  for (const k of UTM_KEYS) { const v = clean(d.body[k], 200); if (v) fields.push({ name: k, value: v }); }

  const context = {};
  const hutk = clean(d.body.hutk, 100);
  if (hutk) context.hutk = hutk; // stitches this submission to the pixel's anonymous session
  if (d.page) context.pageUri = d.page;
  const pageName = clean(d.body.pageName, 200);
  if (pageName) context.pageName = pageName;

  const url = host + '/submissions/v3/integration/submit/' + portal + '/' + env.HUBSPOT_FORM_GUID;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, context }),
  });
}
