# standard.site publishing

This build publishes the site to the [standard.site](https://standard.site) AT
Protocol lexicons so content becomes discoverable on the decentralized social
web:

- one `site.standard.publication` record (rkey `self`) for the site, and
- one `site.standard.document` record per non-hidden content entry (rkey = the
  slug), across every content type present — blog posts (`/blog/<slug>`) and,
  where the site has them, material chapters (`/material/<slug>`).

Records are written to a Bluesky/PDS account during `npm run build`
(`standard-site/publish.ts`). The consuming website only serves the verification
artifacts (`/.well-known/site.standard.publication` and per-post
`<link rel="site.standard.document">`), which it derives from the account DID +
slug — no data is shipped from here to the website.

This module is **publication-agnostic**: every account-specific value comes from
the environment, and publishing is **opt-in** — if `BSKY_APP_PASSWORD`,
`BSKY_HANDLE` and `STANDARD_SITE_URL` are not all set, the step is skipped. The
same shared submodule can therefore serve several websites (e.g. angular.schule
and angular-buch.com); each parent repo supplies its own config.

## Configuration

| Env var | Required | Description |
| --- | --- | --- |
| `BSKY_APP_PASSWORD` | yes | Bluesky **app password** (not the account password). Secret. |
| `BSKY_HANDLE` | yes | Account handle, e.g. `angular.schule`. |
| `STANDARD_SITE_URL` | yes | Publication base URL, e.g. `https://angular.schule` (no trailing slash). |
| `BSKY_PDS` | no | PDS host. Default `https://bsky.social`. |
| `STANDARD_SITE_NAME` | no | Publication name. Default: the handle. |
| `STANDARD_SITE_DESCRIPTION` | no | Publication description. |
| `STANDARD_SITE_EXPECTED_DID` | no | Abort if the logged-in DID differs (guards against a wrong account). |
| `STANDARD_SITE_ICON` | no | Publication profile image (square ≥256×256, png/jpg/webp). An http(s) URL or a local file path; uploaded as a blob and set as the publication `icon`. |
| `STANDARD_SITE_SHOW_IN_DISCOVER` | no | `false` to opt out of the discovery feed. Default `true`. |
| `STANDARD_SITE_DRY_RUN` | no | `true` logs the records that would be written/pruned without touching the PDS. |

## One-time setup

1. **Create an app password.** In Bluesky: Settings → Privacy and Security →
   App Passwords → *Add App Password*. Copy the `xxxx-xxxx-xxxx-xxxx` token.
2. **Resolve the account DID** (public, no auth):
   ```
   curl "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=angular.schule"
   ```
   Put the returned `did:plc:…` into `STANDARD_SITE_EXPECTED_DID` here **and**
   into `STANDARD_SITE_DID` in the website
   (`src/app/blog/shared/standard-site.config.ts`).
3. **Add the CI secret.** In the parent repo (e.g. `website-articles`) →
   Settings → Secrets and variables → Actions → add `BSKY_APP_PASSWORD`. The
   non-secret values live in `.github/workflows/build-article-data.yml`.

## Running

- **CI:** publishing happens automatically inside the existing article-data
  build once the secret is set. New/removed/hidden posts sync on the next build.
- **Local:** `cp .env.example .env`, fill in `BSKY_APP_PASSWORD`, then
  `npm run build`. Without a `.env` the build runs normally and skips publishing.
- **Preview:** prefix a local build with `STANDARD_SITE_DRY_RUN=true` to log
  exactly what would be written/pruned without calling the PDS.

## Behaviour

- Idempotent: records use stable rkeys (`self` / slug), so re-runs update in
  place — never duplicates.
- Prunes: document records whose slug is no longer a live (non-hidden) post are
  deleted.
- `validate: false` is used on `putRecord` because a PDS does not natively know
  third-party lexicons like `site.standard.*`.

## Adding another website (e.g. angular-buch.com)

No change to this submodule. In that website's `website-articles` parent repo:
add the same env block to its build workflow with its own handle / URL / name /
DID, and add its `BSKY_APP_PASSWORD` secret. Publishing turns on automatically.
