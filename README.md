# GameCastle Pinterest Traffic Engine

An automated, safety-limited Pinterest publishing pipeline for GameCastle.

## Pipeline

1. Discover indexable pages from the website.
2. Generate a unique Pinterest creative and metadata for each page.
3. Add UTM attribution to every destination URL.
4. Publish at a daily safety limit (default: 3, maximum: 8).
5. Record Pinterest IDs, failures, and campaign state to prevent duplicates.

## Required Edge Function secrets

Secrets are never stored in browser-readable database tables.

```text
PINTEREST_ACCESS_TOKEN
PINTEREST_BOARD_ID
AUTOMATION_SECRET
ADMIN_EMAIL
```

Invoke `automation-run` from a trusted scheduler with `X-Automation-Secret`.
The endpoint accepts `website_url` and `daily_limit`; limits above 8 are rejected.

## Local verification

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```
