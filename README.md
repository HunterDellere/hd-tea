# hd-tea

A static atlas of tea for a tea master and their clients: origins and terroir, the six tea types and tisanes, craft from garden to firing, and the table where it lands. Built on the jiaoluo-shuwu architecture (markdown content, Node build, validators as a quality gate), with its own visual and factual world.

## Quick start

```
npm install
npm run build     # generate pages/ + data/ from content/
npm run serve     # http://localhost:8080
```

## Scripts

- `npm run build` — generate `pages/` and `data/` from `content/`
- `npm run validate` — schema-check content frontmatter
- `npm run check` — post-build link/parity check + voice gate + claims gate
- `npm run verify` — validate + build + check (run before pushing; the pre-push hook runs it)

## How it works

Content lives in `content/<category>/<slug>.md` (frontmatter + HTML body). The build generates each page's hero, sidebar TOC, terroir map, steep curve, and sources block, then writes `pages/`. Two visual registers share one set of structural atoms: the **cup** (a liquor circle whose color comes from each tea's `liquor:` hex) and the **steep curve** (the infusion timeline). Light mode is a warm porcelain catalogue; dark mode is an iron-glaze session view.

## The quality gate

The site's two promises are enforced by validators that block the build and the push:

- **No AI slop.** `build/validate-voice.mjs` errors on em-dashes and hard health claims, warns on the machine-checkable AI tells. The judgment-level tells are covered by `templates/_drafting/VOICE.md` and the vendored humanizer skill; run the humanizer pass on every draft.
- **No unsourced facts.** `build/validate-claims.mjs` gates `content_review: verified` behind a registered source list, checks canonical claims against `data/_reference/`, and enforces cross-page consistency. Content ships `pending` until reviewed.

Terroir maps are drawn at build time from vendored Natural Earth data at real coordinates; they are accurate, not decorative.

Full architecture and authoring guidance is in `CLAUDE.md` and `templates/_drafting/`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: verify, build, and publish to GitHub Pages. The site is a PWA (installable, offline-capable via `sw.js`).
