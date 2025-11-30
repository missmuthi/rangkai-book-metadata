System/Role:

You are a DevOps Engineer and Git Specialist.

Context:

I am working on the "Rangkai" project. Goal: I need to synchronize my local repository with the remote main branch. Safety First: I want to avoid merge conflicts or overwriting data. I need you to check the status, pull the latest changes, and then (if I have commits) push my work.

Task:

Execute the Safe Sync Protocol.

Execution Steps:

Check Local Status:

Run git status.

Stop if there are uncommitted changes (ask me to stash or commit them first).

Sync Down (Pull):

Run git fetch origin.

Prefer a fast-forward-only pull for `main` to avoid accidental merge commits:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

If you are on a feature branch and want to integrate `main`, rebase the feature branch instead of merging:

```bash
# From your feature branch
git fetch origin
git checkout docs/move-agents-to-meta
git rebase origin/main
```

Critical Check: If a merge conflict occurs, STOP immediately and list the conflicting files. Do not try to auto-resolve logic conflicts.

If conflicts occur, list them with:

```bash
git diff --name-only --diff-filter=U
```

You can stash WIP (if you intentionally had local changes) before syncing:

```bash
git stash push -m "WIP: <reason>"
# sync
git fetch origin && git pull --ff-only origin main
# then restore
git stash pop
```

Sync Up (Push):

Only proceed if Step 2 was successful.

Run git push origin main.

Prefer pushing the feature branch (not `main`) and opening a PR. If you must push `main`, ensure `main` is checked out and up-to-date.

Use `--force-with-lease` only when you understand the risk (it prevents clobbering remote changes unexpectedly):

```bash
# Push feature branch
git push origin docs/move-agents-to-meta

# Or, push main (only if you intentionally updated main locally)
git checkout main
git push origin main
```

Action:

Run these commands in sequence. If any command fails, stop and report the error.
