# Clubtech — branded landing page

Plain static site: hand-written HTML, generated HTML, CSS, and JavaScript. No framework and no production runtime dependencies.

- `index.html` — the landing page
- `css/styles.css` — design system ported from the original deck-aligned styles
- `css/blog.css` — "The Index" blog design
- `js/main.js` / `js/blog.js` — scroll interactions, deferred hero-video loading, category filter
- `brand/`, `video/`, `assets/blog/` — assets (hero video re-encoded to 30 fps, ~1.5 MB, faststart, real poster frame)

## Authoring and generated output

Edit the source, then regenerate. Do not hand-edit generated routes.

- Hand-built pages: `index.html`, `platform/`, `sell/`, `grow/`, `delivery/`, `book-a-demo/`.
- Root landing sources: `content/landing/*.md` → `/<slug>/index.html`.
- Solution/comparison sources: `content/pages/*.md` → `solutions/` and `compare/`.
- Editorial sources: `content/blog/*.md` → `blog/`.
- Shared renderer and chrome: `scripts/build-blog.mjs`.
- Public claim and pathway configuration: `scripts/site-config.mjs`.
- Generated route/link audit: `npm run audit:site`.

The generator rewrites all generated directories and injects shared navigation
and footer markup into the hand-built pages. Preserve unrelated worktree changes
and review the generated diff after every build.

## Blog

Follows the ctg-landingpage blog protocol: author `content/blog/<slug>.md`
(flat frontmatter: title, titleTag, slug, date, author, category, excerpt,
hero, heroAlt, description; `## Questions operators ask` → FAQPage JSON-LD),
then:

```
npm run build:blog
```

`scripts/build-blog.mjs` (zero dependencies — built-in markdown renderer) emits
`blog/<slug>/index.html`, the `blog/index.html` directory page, and
the landing, solution, comparison, `sitemap.xml`, and `llms.txt` outputs. Commit
the source and generated output together. The site is self-canonical at
`www.clubtechglobal.com`.

Run the complete local verification with:

```
npm run verify
```

## Deploy

Staging and production use guarded release-symlink handoffs. Staging replaces
`landingpage.tapbooknow.com`; production provisions an isolated
`/var/www/sites/ctg-branded-landing` root and performs a reversible Apache vhost
cutover for `www.clubtechglobal.com`. See `deploy/README.md`; do not deploy from
GitHub Pages and do not run the root activation scripts without their host pins.

GitHub Pages at https://bradvatne.github.io/ctg-branded-landing/ — `gh-pages`
branch mirrors this branch's files plus `.nojekyll`.

To preview locally: `python3 -m http.server 8000` and open http://localhost:8000/.

History note: repo renamed from `ctg-presold` on 2026-07-12. Before July 2026
it held the original Next.js/vinext app (history up to 671dd02).
