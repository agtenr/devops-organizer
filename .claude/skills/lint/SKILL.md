<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->
---
name: lint
description: Lint and format-check the codebase (ESLint + Prettier). Use before considering a change done.
allowed-tools: Bash
---

# Lint & format

> The scripts below are defined in `package.json` (`lint`, `format`, `format:check`).

```bash
npm run lint          # ESLint (typescript-eslint + react-hooks)
npm run format:check  # Prettier in check mode (non-mutating) — this is the "done" gate
```

Done = `npm run lint` reports no ESLint errors AND `npm run format:check` reports no
changes needed (both commands exit 0).

To *fix* formatting rather than just check it, run `npm run format` (Prettier `--write`,
rewrites files). Use `format` to repair, then re-run `format:check` to confirm.
