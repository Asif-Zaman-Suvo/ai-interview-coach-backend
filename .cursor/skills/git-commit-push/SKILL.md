---
name: git-commit-push
description: Writes proper conventional commit messages and pushes to GitHub. Use this skill whenever the user wants to commit code, push changes, write a commit message, stage files, or do anything related to git commits and pushing to a remote. Trigger even if the user says things like "commit my changes", "push to github", "save my progress", "git push", "commit this", or "push my code". This skill should be used aggressively — if there's any git-related intent, use it.
---

# Git Commit & Push Skill

Helps write well-structured conventional commit messages and safely push code to GitHub.

## What This Skill Does

1. Checks what has changed (`git status` + `git diff`)
2. Understands the nature of the changes
3. Writes a proper conventional commit message
4. Stages, commits, and pushes — with the user's confirmation

---

## Step 1 — Understand the Changes

Before writing any commit message, always run these commands first:

```bash
git status
git diff --staged
git diff
```

Read the output carefully. You need to understand:
- Which files changed
- What kind of change it is (new feature, bug fix, style, refactor, etc.)
- Which part of the codebase is affected (scope)

Never write a commit message based on what the user says alone — always look at the actual diff.

---

## Step 2 — Write the Commit Message

Use the **Conventional Commits** format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types — pick the most accurate one

| Type | When to use |
|---|---|
| `feat` | A new feature or visible functionality |
| `fix` | A bug fix |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `style` | Formatting, whitespace, missing semicolons (no logic change) |
| `chore` | Dependency updates, config changes, tooling |
| `docs` | Documentation only changes |
| `test` | Adding or updating tests |
| `perf` | Performance improvements |
| `ci` | CI/CD pipeline changes |
| `build` | Build system or external dependency changes |
| `revert` | Reverting a previous commit |

### Scope — the affected area

Use the folder name, module, or feature area affected:
- `auth`, `dashboard`, `api`, `sidebar`, `layout`, `interview`, `resume`, `analytics`
- Use the most specific scope that makes sense
- Omit scope only if the change is truly global

### Short description rules
- Lowercase, no period at the end
- Imperative mood: "add", "fix", "update" — not "added", "fixed", "updated"
- Max 72 characters on the first line
- Be specific — describe WHAT changed, not HOW

### Body (include when helpful)
- Explain WHY the change was made, not what
- Wrap at 72 characters per line
- Leave a blank line between subject and body

### Footer (include when relevant)
- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Closes #42` or `Fixes #17`

---

## Step 3 — Stage Files

Ask the user if they want to stage all changed files or specific ones:

- **All changes:** `git add .`
- **Specific files:** `git add <file1> <file2>`
- **Interactive:** `git add -p` (for partial staging)

If the user didn't specify, default to `git add .` but confirm before running.

---

## Step 4 — Confirm Before Committing

Always show the user the full commit message before running it:

```
📝 Commit message:

feat(dashboard): add score trend line chart

Replace dot-only scatter plot with smooth monotone line chart.
Improves readability and makes score progression clearer.

Closes #12

Proceed? (yes to commit and push)
```

Wait for the user to confirm. If they want changes, revise and show again.

---

## Step 5 — Commit and Push

Once confirmed, run:

```bash
git commit -m "<subject>" -m "<body if any>"
git push origin <current-branch>
```

To get the current branch name:
```bash
git branch --show-current
```

If the branch has no upstream yet:
```bash
git push --set-upstream origin <branch-name>
```

After pushing, confirm success and show the commit hash:
```bash
git log --oneline -1
```

---

## Examples

**Example 1 — New feature**
```
feat(interview): add animated waveform visualizer

Display real-time audio waveform bars while the mic is active.
Uses Web Audio API for visualization without external dependencies.
```

**Example 2 — Bug fix**
```
fix(sidebar): prevent content overlap on desktop layout

Sidebar was using position:fixed causing it to overlap page content.
Changed to sticky positioning within a flex container.
```

**Example 3 — Style/UI change**
```
style(dashboard): update stat cards to Notion-style design

Remove colored icon backgrounds and heavy shadows.
Use flat cards with subtle borders and muted typography.
```

**Example 4 — Chore**
```
chore: install recharts and next-themes dependencies
```

**Example 5 — Multiple scopes**
```
refactor(auth,layout): separate marketing and dashboard layouts

Move dashboard into app/(dashboard) route group.
Create app/(marketing) layout without sidebar for landing pages.
```

---

## Common Mistakes to Avoid

- Never write vague messages like `fix stuff`, `update`, `changes`, `wip`
- Never use past tense (`added feature`) — use present tense (`add feature`)
- Never put everything in one giant commit when changes are clearly separate
- Never skip the scope when the change is clearly scoped to one area
- Never commit without checking `git status` first — you might stage unintended files

---

## If There's Nothing to Commit

If `git status` shows nothing to commit, tell the user clearly:

> "Nothing to commit — your working tree is clean. All changes are already pushed."

---

## If There Are Merge Conflicts

If `git push` fails due to conflicts:

1. Run `git pull --rebase origin <branch>`
2. Resolve conflicts, then `git rebase --continue`
3. Push again: `git push origin <branch>`

Explain each step clearly to the user.

---

## Branch Naming (bonus — if user asks)

If the user asks to create a new branch before committing:

```
<type>/<short-description>
```

Examples:
- `feat/landing-page`
- `fix/sidebar-overlap`
- `refactor/dashboard-layout`
- `chore/install-dependencies`
