<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->
---
name: lint
description: Lint and format-check the codebase (ESLint + Prettier). Use before considering a change done.
allowed-tools: Bash
---

# Lint & format

> **STUB — TODO: verify once the toolchain exists.** No `package.json` yet; the commands
> below are the *intended* lint/format commands and have not been run.

```bash
npm run lint     # expected: ESLint (typescript-eslint + react-hooks)
npm run format   # expected: Prettier (add --check in CI)
```

Done = no ESLint errors and Prettier reports no changes needed.
