# Liam Becker Personal Website

Multi-page static site for Liam Becker with a public portfolio and a password-protected Vault area for private files.

## Pages

Public pages:
- `/index.html`
- `/projects.html`
- `/resume.html`
- `/contact.html`

Protected page:
- `/vault/` (requires Basic Auth via Cloudflare Pages Functions middleware)

## Vault File Management

Upload files into these folders:
- `vault/files/school/`
- `vault/files/work/`
- `vault/files/personal/`

Then commit and push. On deploy, the build script regenerates `vault/index.html` and auto-lists filenames in each category.

### Notes
- Listing is non-recursive (top-level files only).
- Hidden files and `.gitkeep` are ignored.
- Filenames are displayed exactly as they appear.

## Local Build

```bash
npm run build
```

This runs `scripts/generateVault.js` to refresh `vault/index.html`.

## Cloudflare Pages Setup

1. Connect this repository to Cloudflare Pages.
2. Set **Build command** to: `npm run build`
3. Set **Build output directory** to: `/`
4. Add environment variables:
   - `VAULT_USER`
   - `VAULT_PASS`

The vault list regenerates automatically on each deploy after new commits.
