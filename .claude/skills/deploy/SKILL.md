---
name: deploy
description: Deploy the devops-organizer front-end to Azure Static Web Apps via the SWA CLI, authenticating with the deployment token from .claude/aind.env. Use to publish a production build.
allowed-tools: Bash
---

# Deploy (Azure Static Web Apps)

Publishes the production build (`dist/`) to Azure Static Web Apps using the **SWA CLI**
(`swa`, already installed — verified v2.0.9). Authentication uses the **deployment token**
from Azure, stored as `SWA_DEPLOYMENT_TOKEN` in **`.claude/aind.env`** (gitignored — never
commit or print it).

## Steps

```bash
# 1. Load the deployment token (aind.env holds `export SWA_DEPLOYMENT_TOKEN=…`).
source .claude/aind.env
test -n "$SWA_DEPLOYMENT_TOKEN" || { echo "SWA_DEPLOYMENT_TOKEN missing in .claude/aind.env"; exit 1; }

# 2. Produce a fresh production bundle in dist/ (type-check + Vite build).
npm run build

# 3. Deploy dist/ to the production environment, authenticating with the token.
swa deploy ./dist --deployment-token "$SWA_DEPLOYMENT_TOKEN" --env production
```

- **Token, not `az login`.** Authentication is the Azure **deployment token** passed via
  `--deployment-token` — do not use an interactive `az`/`swa login`. Equivalent env-var form:
  `SWA_CLI_DEPLOYMENT_TOKEN=… swa deploy …`. Keep the token out of logs and command echoes.
- **Build first.** `swa deploy` uploads the already-built `dist/` (see the `build` skill); step 2
  guarantees it is current. The app/output locations also live in `swa-cli.config.json`
  (`appLocation: "."`, `outputLocation: "dist"`).
- **`--env production`** publishes to the production environment; omit it (or pass `--env <name>`)
  to push a named **preview** environment instead — the SWA CLI defaults to `preview`.
- Done = the SWA CLI reports a successful deploy and prints the live app URL.
