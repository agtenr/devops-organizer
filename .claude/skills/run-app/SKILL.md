<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->
---
name: run-app
description: Start the devops-organizer app locally on the Vite dev server. Use to run the SPA for manual checks.
allowed-tools: Bash
---

# Run the app

> **STUB — TODO: verify once the toolchain exists.** No `package.json` yet; the command
> below is the *intended* dev command and has not been run.

Requires a local `.env` (copy `.env.sample`) with `VITE_ENTRA_CLIENT_ID`,
`VITE_ENTRA_TENANT_ID`, and `VITE_MAIL_FOLDER`.

```bash
npm run dev   # expected: Vite dev server on http://localhost:5173
```
