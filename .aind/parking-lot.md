# AIND dreaming — parking lot

Suspected FLOW-level problems raised by the dreamer for a human to consider.
These are deliberately NOT encoded as config diffs (the dreamer may not change the flow).

## 2026-07-08T08:06:57Z
Run /aind:onboard now that story 29 has scaffolded the real toolchain. The five skill stubs (build, run-app, test, lint, e2e) still carry now-false "No package.json yet / STUB" banners (the lint skill's was fixed in dream PR #3, the other four remain), and the TS 6 / ESLint 10 / Vitest 4 version-specific config shapes are baked into product-code root files (tsconfig*.json, eslint.config.js, vite.config.ts) outside .claude — re-encoding them in rules would go stale. Reconciling stubs and version shapes against the code that now exists is /aind:onboard's job, not a dreamer edit. Raised by lessons 29-coder-20260708T065133Z and the stub banners generally.

## 2026-07-08T08:07:04Z
Greenfield kickstart front-loads deferred structural decisions onto the first implementation story. Story 29 (the first scaffold story) absorbed 6 plan-assumption threads because the kickstart config deferred concrete decisions with "TODO (undecided)" notes (src/ tree, state-management approach, .env.sample timing). This is inherent to greenfield and one-time — the load concentrates on the first story and dissipates afterward — so it is not productively fixable by a config edit. Recorded for awareness, not action. Raised by lesson 29-planner-20260708T054524Z.

## 2026-07-08T14:30:41Z
Flow-level enforcement gap (from lessons 35-planner-20260708T092955Z, 36-coder-20260708T140334Z): nothing in the AIND flow gates the test suite at story merge. Story 30 shipped with a stale/red src/App/App.test.tsx (asserts a removed hello-world heading; renders <App/> without MsalProvider) and never added its planned TopBar/msalConfig tests, so `npm run test` has been red on main ever since and each later story inherits a failing baseline it did not cause. The "npm run test passes" done-bar exists in testing.md but is not enforced at merge. Config cannot fix this — it needs a flow/gate change a human owns.

## 2026-07-08T14:30:49Z
Flow/command-level contradiction (from lesson 35-coder-20260708T094919Z): /aind:plan folds behavioral-test authoring and stale-test repair into a story's Task breakdown and Definition of done, but /aind:implement mandates "this iteration writes no tests." Every implement run on such a plan therefore ships a code PR with those test tasks and DoD items intentionally deferred, and must explain the divergence in the PR. The two phases disagree on WHEN tests are authored. This is plugin flow/command behavior, not project config — a human should decide whether plans should stop scoping test work into the implement iteration, or the implement iteration should author tests.

