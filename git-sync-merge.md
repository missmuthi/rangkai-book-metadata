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

Run git pull origin main.

Critical Check: If a merge conflict occurs, STOP immediately and list the conflicting files. Do not try to auto-resolve logic conflicts.

Sync Up (Push):

Only proceed if Step 2 was successful.

Run git push origin main.

Action:

Run these commands in sequence. If any command fails, stop and report the error.