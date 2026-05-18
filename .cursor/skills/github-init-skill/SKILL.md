---
name: github-repo-init
description: >-
  Initializes a new local Git repository with README, first commit, SSH remote
  via personal or office GitHub host aliases, and push to main. Use when the
  user creates a new GitHub repo, performs a first push, or wires a new project
  to GitHub with a named repository and account type.
---

# GitHub Repository Initialization

## Overview

Bootstraps a directory as a git repository and pushes it to GitHub using SSH host aliases in `~/.ssh/config`, so personal and office accounts can use different keys without changing the remote hostname.

## When to Use

- The user wants a new repository initialized and pushed to GitHub for the first time.
- The user names a repository and indicates a **personal** or **office** GitHub account (SSH profile).

Before running anything, resolve **Variables** (ask if anything is missing).

## Prerequisites

`~/.ssh/config` must define the hosts the skill references:

```
Host personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa_personal

Host office
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa_office
```

## Variables

Confirm with the user before executing commands:

| Variable | Example | Notes |
|---|---|---|
| `REPO_NAME` | _(from user)_ | Repository name; parse from the request — it differs per project |
| `ACCOUNT_TYPE` | `personal` or `office` | Chooses the SSH host alias |
| `GITHUB_USERNAME` | _(from user)_ | GitHub username or org for the remote path |

## SSH host mapping

| `ACCOUNT_TYPE` | SSH host alias | Remote URL |
|---|---|---|
| `personal` | `personal` | `git@personal:USERNAME/REPO_NAME.git` |
| `office` | `office` | `git@office:USERNAME/REPO_NAME.git` |

## Instructions

1. **`REPO_NAME`** — From the user’s message. Do not reuse a name from an old example.
2. **`ACCOUNT_TYPE`** — `personal` or `office`; ask if unclear.
3. **`GITHUB_USERNAME`** — From the user; do not assume a fixed handle.
4. Run **Command sequence** below with those values. Use the `git remote add` line that matches `ACCOUNT_TYPE`.

## Command sequence

```bash
# 1. Create README
echo "# REPO_NAME" >> README.md

# 2. Initialize git
git init

# 3. Stage and commit
git add README.md
git commit -m "first commit"

# 4. Set main branch
git branch -M main

# 5. Add remote — pick one:
git remote add origin git@personal:GITHUB_USERNAME/REPO_NAME.git
# git remote add origin git@office:GITHUB_USERNAME/REPO_NAME.git

# 6. Push
git push -u origin main
```

## Example

Substitute real values for `<REPO_NAME>`, `<GITHUB_USERNAME>`, and uncomment or select the correct remote line:

```bash
echo "# <REPO_NAME>" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin git@personal:<GITHUB_USERNAME>/<REPO_NAME>.git
git push -u origin main
```
