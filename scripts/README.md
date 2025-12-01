# scripts/

This folder contains helper scripts for the Rangkai project.

## git-sync.sh

Interactive safe sync script to fetch, pull + rebase, and push local commits to `origin/<current-branch>`.

Usage:

```bash
# Make the script executable once (if not):
chmod +x scripts/git-sync.sh

# Run it:
./scripts/git-sync.sh
```

What it does:

- Verifies there are no uncommitted changes; otherwise lets you stash or commit.
- Fetches origin, shows whether the branch is behind/ahead.
- Offers to rebase (recommended) or merge.
- Stops on conflicts and lists conflicting files.
- Pushes local commits to `origin/<current-branch>` if the rebase/merge/pull succeeds.
- Offers to pop stashed changes at the end (if any).

Notes:

- This script uses `git pull --rebase` by default when a remote is ahead; you can choose to merge instead if preferred.
- It is interactive and intended for local, single-developer workflows.
- For CI or automatic runs, use the standard `git` commands and environment policies instead of this script.
