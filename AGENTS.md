<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git Workflow Rules

- Work on only one task per branch.
- Never implement multiple unrelated tasks in the same branch.
- Start each task from the latest main branch.
- Create a new descriptive branch for every task, such as `fix/shift-publication`.
- Prefer a separate Git worktree for each task.
- Never modify main directly.
- After implementation, run relevant tests and review the diff.
- Commit changes with clear commit messages.
- Push the branch and create a GitHub Pull Request targeting main, if GitHub access is available.
- Never merge Pull Requests automatically.
- Wait for explicit user confirmation before starting the next task.
- After the previous PR is merged, synchronize main before creating the next branch.
- Never discard uncommitted changes or delete worktrees without verifying they are safe to remove.
