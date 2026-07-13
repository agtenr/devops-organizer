<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->

# devops-organizer — AIND project rules

> This file layers on top of the installed **aind** plugin (commands, agents, skills, hooks).

## AIND configuration

The AIND scripts read these from the environment. Set them before running AIND commands —
e.g. `source .claude/aind.env` (copy `aind.env.sample`, keep the PAT out of git):

| Variable | Value for this project |
|---|---|
| `AIND_ADO_ORG` | `https://dev.azure.com/agtenrdevgit` |
| `AIND_ADO_PROJECT` | `devops-organizer` |
| `AIND_GH_REPO` | `agtenr/devops-organizer` |
| `AIND_INTEGRATION_BRANCH` | `main` |
| `AIND_PLAN_BRANCH_PREFIX` | `aind/plan/` (optional override) |
| `AIND_LESSONS_BRANCH` | `aind/lessons` (optional override; dreaming-phase exhaust branch) |
| `AZURE_DEVOPS_EXT_PAT` | *(a PAT with Work Items r/w + Code r/w — never commit)* |

## AIND operational rules (apply to every agent run here)

- **One status tag.** A work item carries exactly one `AIND status - <state>` tag. Only ever
  change it via the `aind-status` skill (atomic swap). Never add/remove status tags by hand.
- **Sign every post.** Post ADO comments only via the `aind-comment` skill — it signs by agent
  name. Direct comment calls are blocked by a hook.
- **Plan location.** Plans live at `/plans/<work-item-id>/plan.md` and are permanent living
  documentation — never delete them after the code ships.
- **Reach branches through PRs.** Never construct or assume a branch name to find an artifact;
  resolve via the PR and the `AIND-LINKS` block. The work-item ID is the join value.
- **Don't author stories.** Intake suggests fixes; the human owns the story text.

## Project rules

@rules/frontend-architecture.md
@rules/authentication.md
@rules/categorization-domain.md
@rules/testing.md

## Project-specific guidance

- **Stack:** Vite + React + TypeScript SPA, Fluent UI v9, npm. Front-end only, in-memory
  (max ~100 emails). See `@rules/frontend-architecture.md`.
- **Branch naming:** `type/id-slug` tied to the ADO story ID —
  e.g. `feature/123-customer-tabs`, `fix/130-counter-bug`. Integration branch is `main`.
- **Build / run / test / deploy commands:** see the skills in `.claude/skills/`
  (`build`, `run-app`, `test`, `lint`, `e2e`, `deploy`) — commands are defined in `package.json`
  and verified against the scaffolded toolchain (story 29).

### Deployment
- **Target:** **Azure Static Web Apps**. The production bundle (`dist/`) is published with the
  **SWA CLI** (`swa`, installed) — see the `deploy` skill. App/output locations are pinned in
  `swa-cli.config.json` (`appLocation: "."`, `outputLocation: "dist"`).
- **Auth:** the Azure **deployment token**, stored as `SWA_DEPLOYMENT_TOKEN` in the gitignored
  `.claude/aind.env` (never committed or printed) — passed via `swa deploy --deployment-token`.
  Not an interactive `az login`.
- **CI/CD:** none configured yet — deploys are run manually via the `deploy` skill.
- Toolchain drafts were reconciled against the real codebase via **`/aind:onboard`**
  (2026-07-08); re-run it after major structural changes.
