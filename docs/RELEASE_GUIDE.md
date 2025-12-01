# Release Guide — Rangkai Book Metadata

This guide describes how to trigger a release, how the automated pre-flight checks work, and how to roll back a deployment if necessary.

## Release Triggers

1. Automated deploy via CI (recommended)
   - Pushes to `main` will run the `Preflight & Deploy` workflow (`.github/workflows/preflight.yml`). If the `preflight` job passes, the `deploy` job will publish the build to Cloudflare Pages.

2. Manual deploy (ad-hoc)
   - From a clean `main` branch (no uncommitted changes), run:

```bash
# Install dependencies
npm ci
# Run checks and build
npm run check
npm run lint
npm test
npm run build
# Deploy
npm run deploy # calls `wrangler pages deploy .svelte-kit/cloudflare`
```

## Rollback Procedures

1. Cloudflare Pages UI (preferred)
   - In the Cloudflare Pages dashboard, open the `rangkai-book-metadata` project and navigate to **Deployments**.
   - Find a previous successful deployment and click **Rollback** or **Restore** (Cloudflare Pages keeps a list of previous uploads).

2. Manual rollback (using a specific git commit)
   - Find the commit or tag you want to rollback to:

```bash
git checkout <commit-or-tag>
npm ci
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=rangkai-book-metadata
```

> Note: Deploying a rollback via `wrangler` will create a new deployment based on the build artifacts in the currently checked-out commit.

## Validation and Smoke Tests

After deploy or rollback, run quick sanity checks:

```bash
# Health endpoint
curl -sS https://<deploy-url>/api/health
# Search / ISBN lookup
curl -sS https://<deploy-url>/api/book/9780132350884
```

Also verify key flows in the app (login, scan, merged book card) and monitor logs in Cloudflare to ensure errors or spikes are not present.

## Secrets & Permissions

- Store `CF_API_TOKEN` in your CI provider (GitHub Actions secrets) with the minimum required scope to deploy pages.
- Ensure `wrangler` environment variables (like `account_id` or other secrets) are configured in CI or `wrangler.toml` with proper access restrictions.

## Best Practices

- Keep the `preflight` job strict; consider making `npm run lint` fail on warnings in CI for higher quality.
- Keep `Husky` hooks for local checks (pre-commit and pre-push) and treat them as a developer safety net, not a replacement for CI.
- Tag releases with semver and keep a `CHANGELOG.md` updated for all production releases.

## Emergency Deploys

Follow this process for emergency changes:

1. Create a short-lived branch off `main` with the fix and a brief description of the change.
2. Run the preflight checks locally and ensure tests pass.
3. Create a PR or push directly (if permitted); CI will run the `preflight` job and deploy if checks pass.
4. Document the emergency release in `CHANGELOG.md` and consider reverting the change and developing a follow-up PR if the fix is temporary.

---

For more detail on the release process, see `git-deploy.md` for the pre-flight command sequence and the `preflight.yml` workflow for CI syntax.
