# AIND dreaming — parking lot

Suspected FLOW-level problems raised by the dreamer for a human to consider.
These are deliberately NOT encoded as config diffs (the dreamer may not change the flow).

## 2026-07-08T08:06:57Z
Run /aind:onboard now that story 29 has scaffolded the real toolchain. The five skill stubs (build, run-app, test, lint, e2e) still carry now-false "No package.json yet / STUB" banners (the lint skill's was fixed in dream PR #3, the other four remain), and the TS 6 / ESLint 10 / Vitest 4 version-specific config shapes are baked into product-code root files (tsconfig*.json, eslint.config.js, vite.config.ts) outside .claude — re-encoding them in rules would go stale. Reconciling stubs and version shapes against the code that now exists is /aind:onboard's job, not a dreamer edit. Raised by lessons 29-coder-20260708T065133Z and the stub banners generally.

## 2026-07-08T08:07:04Z
Greenfield kickstart front-loads deferred structural decisions onto the first implementation story. Story 29 (the first scaffold story) absorbed 6 plan-assumption threads because the kickstart config deferred concrete decisions with "TODO (undecided)" notes (src/ tree, state-management approach, .env.sample timing). This is inherent to greenfield and one-time — the load concentrates on the first story and dissipates afterward — so it is not productively fixable by a config edit. Recorded for awareness, not action. Raised by lesson 29-planner-20260708T054524Z.

