# Pinnpoint Website

Static marketing site for Pinnpoint. Every page is a standalone HTML file at the
repo root — open `index.html` to view it locally, or run `npx serve .`

## Hosting — two hosts, one repo

Both deploy automatically from `main` on every commit.

| Host | Serves | Notes |
|---|---|---|
| **GitHub Pages** | **`pinnpt.com`** (apex) — the live public site | Driven by the `CNAME` file. This is the host the public and Google see. |
| **Railway** | `www.pinnpt.com`, which **301s to the apex** | Project `victorious-insight`, service `pinnpoint-website`, port 8080. Also reachable at `pinnpoint-website-production.up.railway.app`. |

Railway runs `serve` (see `package.json`). Note that `serve` uses clean URLs, so the
Railway copy answers `/print-ship` as well as `/print-ship.html`; GitHub Pages serves
only the `.html` paths. Canonical tags on every page point at the apex, so this
difference is not visible in search results.

## What this means when you change things

- **Redirects must be HTML stubs**, not server config. A `serve.json` or `.htaccess`
  would only ever affect the Railway copy — GitHub Pages ignores both. Retired pages
  (`nshift-integrated-label.html`, `roi.html`) therefore use a `noindex` page with a
  canonical, a meta refresh and `location.replace`.
- **`.htaccess` in this repo is inert.** Neither host reads it. It is left in place
  only because nothing has confirmed it is safe to delete.
- **There is no shared stylesheet.** Every page carries its own complete inline
  `<style>` block; only `/assets/fonts.css` is external. Any CSS change is the same
  edit repeated in every page file.

## Layout

- `assets/` — images, SVGs, fonts, `analytics.js`, `consent.js`
- `api/` — the form intake service (separate from the marketing site)
- `tools/` — internal utilities
- language and legacy-URL folders (`de/`, `es/`, `nl/`, `product/`, …) — redirect stubs
  for old WordPress paths

Auto-deploy connected to GitHub on 2026-07-25. Last reviewed 2026-08-24.
