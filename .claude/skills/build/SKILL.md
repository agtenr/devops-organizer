---
name: build
description: Build the devops-organizer front-end (type-check + Vite production build). Use to verify a change compiles cleanly.
allowed-tools: Bash
---

# Build

The `build` script is defined in `package.json`: `tsc -b && vite build` (verified 2026-07-08).

```bash
npm run build   # tsc -b (project references: tsconfig.app.json + tsconfig.node.json) then vite build
```

- Type-checks via TypeScript project references (`tsconfig.json` → `tsconfig.app.json` +
  `tsconfig.node.json`), then produces the production bundle in `dist/` (gitignored).
- Done = the build completes with no TypeScript or Vite errors.
