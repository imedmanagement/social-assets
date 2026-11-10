# social-assets

Public image hosting for Independent Med Management (IMM) and IMM Academy social posts.
Instagram's API only accepts images from a public web address, so the daily posting run
takes its Story images from here.

## Layout

- `specs/` weekly job lists (one JSON file per week of six posts).
- `render/` the canvas renderer (`cards.js`) and runner (`render.mjs`).
- `assets/` fonts (OFL) and brand images used by the renderer.
- `cards/` 1080 x 1350 feed cards (4:5).
- `stories/` 1080 x 1920 Stories (9:16), plus `stories/index.json` listing every image with its public URL.

Public URL pattern:
`https://raw.githubusercontent.com/imedmanagement/social-assets/main/stories/<id>.jpg`

## How it runs

Pushing a change to `specs/`, `render/` or `assets/` starts the **Render social images**
workflow. It renders any missing cards and Stories in Chrome and commits them back.
Run it by hand from the Actions tab with `force = 1` to re-render everything.

Local run: `node render/render.mjs` (needs Playwright).

## Rules

- IMM and IMM Academy content only.
- No client, claimant or case information. Marketing images only.
