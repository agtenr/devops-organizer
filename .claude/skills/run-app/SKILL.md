---
name: run-app
description: Start the devops-organizer app locally on the Vite dev server. Use to run the SPA for manual checks.
allowed-tools: Bash
---

# Run the app

The `dev` script is defined in `package.json`: `vite` (verified 2026-07-08).

```bash
npm run dev   # Vite dev server on http://localhost:5173
```

- **No `.env` is required yet.** The current app is a hello-world SPA that reads no
  environment variables. The `VITE_ENTRA_CLIENT_ID` / `VITE_ENTRA_TENANT_ID` /
  `VITE_MAIL_FOLDER` vars described in `.claude/rules/authentication.md` (and the committed
  `.env.sample`) arrive with the **authentication story**, not before — do not assume they
  exist yet.
- To preview a production build instead of the dev server: `npm run preview`.
