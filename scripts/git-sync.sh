#!/usr/bin/env bash
# scripts/git-sync.sh
# Interactive safe sync (fetch/pull/rebase/merge/push) for a single-branch workflow
# Usage: ./scripts/git-sync.sh
# - Prompts if uncommitted changes exist (stash/commit/abort)
# - Fetches origin, shows divergence counts
# - Offers rebase (recommended) or merge
# - Stops on conflicts (lists conflicting files). Does not auto resolve.
# - Pushes local commits after successful pull/rebase/merge

set -euo pipefail
IFS=$'\n\t'

# Helper functions
msg() { printf "\033[1;34m%s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m%s\033[0m\n" "$*"; }
err() { printf "\033[1;31m%s\033[0m\n" "$*"; }

confirm() {
  # $1 = prompt, default y
  local prompt="$1"
  local default=${2:-Y}
  local answer
  read -r -p "$prompt [$default] " answer
  answer=${answer:-$default}
  case "$answer" in
    [Yy]* ) return 0 ;;
    * ) return 1 ;;
  esac
}

abort_if_dirty() {
  # If uncommitted changes exist, ask to stash or commit or abort
  local status
  status=$(git status --porcelain)
  if [[ -n "$status" ]]; then
    warn "Found uncommitted changes in working tree."
    echo
    echo "Options:"
    echo "  1) Stash them (recommended)"
    echo "  2) Commit them now"
    echo "  3) Abort sync"
    echo
    read -r -p "Choose 1/2/3 > " choice
    case "$choice" in
      1)
        git stash push -m "Auto stash by scripts/git-sync.sh" || true
        msg "Changes stashed." ;;
      2)
        echo "I'll add all changes and commit them for you."
        read -r -p "Commit message (default: 'chore: sync - auto commit'): " cm
        cm=${cm:-"chore: sync - auto commit"}
        git add -A
        git commit -m "$cm"
        msg "Committed changes with message: $cm" ;;
      *)
        err "Aborting: uncommitted changes must be handled first."
        exit 1 ;;
    esac
  fi
}

list_conflicts() {
  local conflicts
  conflicts=$(git ls-files -u | awk '{print $4}' | sort -u || true)
  if [[ -n "$conflicts" ]]; then
    err "Merge/rebase conflicts detected in the following files:";
    echo "$conflicts" | sed -n '1,999p'
  else
    warn "No unmerged conflicts detected via git ls-files -u.";
  fi
}

# Main flow
main_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ -z "$main_branch" ]]; then
  err "Unable to detect current branch. Are you in a git repo?"
  exit 1
fi

msg "Safe Git Sync helper"
msg "Branch: $main_branch"

# Check uncommitted changes
abort_if_dirty

msg "Fetching latest updates from origin..."
git fetch origin

# Show divergence
counts=$(git rev-list --left-right --count "origin/$main_branch...$main_branch" 2>/dev/null || true)
if [[ -n "$counts" ]]; then
  left_right=($counts)
  behind=${left_right[0]}
  ahead=${left_right[1]}
else
  behind=0
  ahead=0
fi
msg "Remote vs Local: behind=$behind, ahead=$ahead"

# If remote has changes, ask whether to rebase or merge
if [[ "$behind" -gt 0 ]]; then
  msg "Remote has $behind commits ahead of your local branch.";
  echo "Recommended: rebase to keep linear history."
  if confirm "Proceed with rebase onto origin/$main_branch? (Y/n)" "Y"; then
    msg "Rebasing local commits onto origin/$main_branch..."
    set +e
    git pull --rebase origin "$main_branch"
    rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
      err "Rebase encountered conflicts or failed; stopping (exit code $rc)."
      list_conflicts
      err "Please resolve conflicts, then run 'git rebase --continue' or abort with 'git rebase --abort'"
      exit 2
    fi
  else
    if confirm "Perform merge instead (create a merge commit)?" "N"; then
      msg "Merging origin/$main_branch into local..."
      set +e
      git pull --no-rebase origin "$main_branch"
      rc=$?
      set -e
      if [[ $rc -ne 0 ]]; then
        err "Merge encountered conflicts or failed; stopping (exit code $rc)."
        list_conflicts
        err "Please resolve conflicts and commit the result.")
        exit 3
      fi
    else
      err "No action taken. Aborting."
      exit 0
    fi
  fi
else
  msg "Local branch is up to date with remote or ahead. Nothing to pull."
fi

# Confirm push if there are local-only commits
local_ahead=$(git rev-list --left-right --count "origin/$main_branch...$main_branch" | awk '{print $2}')
if [[ "$local_ahead" -gt 0 ]]; then
  msg "You have $local_ahead local commit(s) not pushed to origin/$main_branch.";
  if confirm "Push local commits to origin/$main_branch now? (Y/n)" "Y"; then
    git push origin "$main_branch"
    msg "Push complete."
  else
    warn "Push skipped by user. You can push manually later: git push origin $main_branch"
  fi
else
  msg "No local commits to push."
fi

# If we stashed earlier, offer to apply stash
stash_count=$(git stash list | wc -l | tr -d ' ')
# If stash_count more than 0 and the stash is ours
if [[ "$stash_count" -gt 0 ]]; then
  msg "There are $stash_count stash entry(ies)."
  if confirm "Would you like to pop the most recent stash? (Y/n)" "N"; then
    git stash pop
    msg "Popped stash.";
  else
    msg "Stash retained. You can pop manually later."
  fi
fi

msg "Safe sync completed."

exit 0
