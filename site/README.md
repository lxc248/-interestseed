# InterestSeed landing page

`index.html` is a single-file immersive landing page for InterestSeed.

## Content

- Hero: `Instantly turn saved notes into testable interests.`
- Code hint: `interestseed scan --vault ~/notes`
- Cards: one connection at a time / 3-day experiment / local-first
- Ending: `Presenting / InterestSeed 4`

## Performance design

This is intentionally smoother than a scroll-scrubbed video page:

- no external video request;
- one full-screen canvas for the cosmic background, not two canvases;
- one `requestAnimationFrame` loop for hero fade, cards and background;
- `getBoundingClientRect()` is measured on load/resize, not every frame;
- mask updates are skipped unless the reveal changes by more than 0.35%;
- DPR is capped at 1.5;
- canvas drawing is capped at about 30fps;
- no `backdrop-filter` on the cards;
- `prefers-reduced-motion` is respected.

Measured in headless Chromium at 1440×1000:

```text
~61 fps
no console errors
```

## Run locally

```bash
cd site
python -m http.server 8100
```

Open `http://127.0.0.1:8100`.

## Deploy

Any static host works. For GitHub Pages, publish the `site/` directory.
For Cloudflare Pages, set the build output directory to `site`.

## Copy

Keep the description consistent with the repository and release notes:

```text
InterestSeed is a local-first interest validator for any Markdown vault.
Local AI suggests one testable connection; a 3-day experiment decides.
```

## Pages

- `/` — immersive hero + cards + reveal
- `/how-it-works/` — long-form explanation, install, FAQ and FAQPage schema
- `/3-day-interest-experiment/` — practical experiment guide and template
- `/interestseed-vs-readwise/` — capture vs validation comparison
- `/interestseed-vs-obsidian/` — workspace vs validation-layer comparison
- `/llms.txt` — canonical summary for AI crawlers
- `/robots.txt` — allows search and AI crawlers
- `/sitemap.xml` — all public pages
- `content.css` — shared stylesheet for article pages

