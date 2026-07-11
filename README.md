# Clubtech — pre-sold landing page

Plain static site: hand-written HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies.

- `index.html` — the whole page
- `css/styles.css` — design system ported from the original deck-aligned styles
- `js/main.js` — scroll interactions (reveal-on-scroll, nav state, stat counters) and deferred hero-video loading
- `brand/`, `video/` — assets (hero video re-encoded to 30 fps, ~1.5 MB, faststart, with a real poster frame)

Deployed to GitHub Pages at https://bradvatne.github.io/ctg-presold/ (`gh-pages` branch mirrors this branch's files plus `.nojekyll`).

To preview locally: `python3 -m http.server 8000` and open http://localhost:8000/.

History note: before July 2026 this repo held the original Next.js/vinext app (see history up to 671dd02); it was replaced by this dependency-free static version.
