System/Role:

You are a Senior Release Engineer and DevOps Specialist. Your job is to gatekeep the production environment. You must certify that the codebase is stable, clean, and secure before executing a deployment.

Context:

We are deploying "Rangkai" (SvelteKit) to Cloudflare Pages. Current Status: Development is complete. Goal: Deploy to production, but ONLY if all health checks pass.

Task:

Execute the "Pre-Flight Release Sequence".

Execution Protocol (Stop IMMEDIATELY if any step fails):

1. Git Hygiene Check

Command: git status --porcelain

Requirement: The result must be empty (clean working tree). If there are uncommitted changes, STOP and list them.

Command: git branch --show-current

Requirement: Must be on main.

2. Dependency Audit

Command: npm outdated

Action: Report any "Red" (Major version) updates, but DO NOT update them now (too risky before deploy). Just log them as a warning.

Command: npm audit --audit-level=high

Requirement: Zero high-severity vulnerabilities.

3. Code Integrity Check

Type Safety: npm run check (Must pass).

Linting: npm run lint (Must pass).

Unit Tests: npm test (Must pass 100%).

4. Production Build Simulation

Command: npm run build

Requirement: The build must finish without errors.

Check: Verify the .svelte-kit/cloudflare directory was created.

5. The Deployment (Only if Steps 1-4 Passed)

Command: npm run deploy (or wrangler pages deploy .svelte-kit/cloudflare --project-name=rangkai-book-metadata).

Post-Deploy: output the live URL.

Action:

Begin the sequence. Report status at each step.

---

## Release Checklist (Automated + Manual)

Use this checklist to ensure releases are automated and gated behind the same pre-flight checks that were run manually.

1. Manual Pre-Flight (Ad-hoc release from a workstation)
	 - Ensure the repo is clean and on `main` (git status --porcelain, git branch --show-current).
	 - Run `npm ci` or `npm install` to install dependencies.
	 - Run the full pre-flight sequence:
		 - `npm run check` (Type safety)
		 - `npm run lint` (Linting)
		 - `npm test` (Unit tests)
		 - `npm run build` (Production build simulation)
	 - If all checks pass, run `npm run deploy` or `wrangler pages deploy .svelte-kit/cloudflare --project-name=rangkai-book-metadata`.

2. Automated CI Pre-Flight (GitHub Actions recommended)
	 - Create a CI job to run on `push`/`pull_request` targeting `main` and release branches.
	 - The CI job should run the following steps and FAIL the job on any non-zero exit code:
		 1. `npm ci`
		 2. `npm run check`
		 3. `npm run lint` (optional: consider treating warnings as errors in CI to maintain higher quality)
		 4. `npm test` (All tests must pass)
		 5. `npm run build` (Verify build artifacts are produced)
	 - If CI passes, create a separate job to deploy (only on protected `main` branch):
		 - `wrangler pages deploy .svelte-kit/cloudflare --project-name=rangkai-book-metadata`
	 - Example (GitHub Actions) snippet (paste this into `.github/workflows/preflight.yml`):

```yaml
name: Preflight & Deploy
on:
	push:
		branches: [ main ]
	pull_request:
		branches: [ main ]

jobs:
	preflight:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- name: Setup Node
				uses: actions/setup-node@v4
				with:
					node-version: 20
			- name: Install dependencies
				run: npm ci
			- name: Type check
				run: npm run check
			- name: Lint
				run: npm run lint
			- name: Unit tests
				run: npm test
			- name: Build
				run: npm run build

	deploy:
		needs: preflight
		if: github.ref == 'refs/heads/main' && github.event_name == 'push'
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- name: Setup Node
				uses: actions/setup-node@v4
				with:
					node-version: 20
			- name: Install and Build
				run: |
					npm ci
					npm run build
			- name: Deploy to Cloudflare Pages
				env:
					CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
				run: |
					npx wrangler pages deploy .svelte-kit/cloudflare --project-name=rangkai-book-metadata
```

3. Release Automation Notes
	 - Keep `CF_API_TOKEN` secret configured in GitHub Actions or CI provider.
	 - Consider treating eslint warnings as errors in CI to gate quality (particularly `no-explicit-any` in tests or shared code paths).
	 - Keep the Husky pre-push hook as a local safety net for developers, not a replacement for CI.
	 - If you need to roll out emergency changes, follow `git-deploy.md` and record the reason in your release notes.

4. Post-Deployment Validation
	 - Check the live URL reported by `wrangler` or Cloudflare Pages after a deploy — sample format: `https://<random-id>.rangkai-book-metadata.pages.dev`.
	 - Run a smoke test (a minimal E2E test or curl to `/api/health`) to validate the deployment.
	 - Monitor logs (Cloudflare Worker metrics) and Analytics for warnings or error spikes.

---

Happy deploys! ✅
