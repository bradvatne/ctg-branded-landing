# Clubtech — branded landing page

Plain static site: hand-written HTML, CSS, and JavaScript. No frameworks, no runtime dependencies.

- `index.html` — the landing page
- `css/styles.css` — design system ported from the original deck-aligned styles
- `css/blog.css` — "The Index" blog design
- `js/main.js` / `js/blog.js` — scroll interactions, deferred hero-video loading, category filter
- `brand/`, `video/`, `assets/blog/` — assets (hero video re-encoded to 30 fps, ~1.5 MB, faststart, real poster frame)

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
`sitemap.xml`. Commit the source AND the generated output. Posts canonicalize
to the originals on www.clubtechglobal.com so this mirror doesn't compete with
the primary blog in search.

## Deploy

GitHub Pages at https://bradvatne.github.io/ctg-branded-landing/ — `gh-pages`
branch mirrors this branch's files plus `.nojekyll`.

To preview locally: `python3 -m http.server 8000` and open http://localhost:8000/.

History note: repo renamed from `ctg-presold` on 2026-07-12. Before July 2026
it held the original Next.js/vinext app (history up to 671dd02).
