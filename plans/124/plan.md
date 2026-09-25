# Plan — Story 124: Application styling upgrades

## Context

The app looks black and white today: every component uses Fluent UI's default neutral gray
tokens, with no color of its own. Story 124 asks for a real color scheme, applied the same way
everywhere, that works in both light and dark mode. The story attached an example color image
instead of written details and asked the planner to design the approach and ask the right
questions.

*Dev-seeded (decided in planning with the dev):* no extra steering beyond the sampled palette —
the dev said "go" and picked the design options below live.

**Found:** the app already has a working light/dark toggle (`ThemeProvider.tsx`, story 87), but
it feeds Fluent's stock `webLightTheme`/`webDarkTheme` — no custom color. Every component already
uses Fluent's `tokens.*` design tokens (`colorNeutralBackground1`, `colorNeutralForeground3`, …)
instead of hardcoded colors, so swapping the underlying theme is the single biggest lever for
"apply everywhere."

**Found:** the story's attached image is 5 flat color bars. I downloaded it and sampled the exact
pixel color of each bar:

| Swatch | Hex |
|---|---|
| Blue | `#328CC1` |
| Orange | `#D98310` |
| Dark navy | `#083C5D` |
| Near-black | `#1D2731` |
| Gray | `#AAAAAA` |

**Decided in planning with the dev** (from the live design questions):
- Use the blue as the single Fluent **brand color** everywhere (buttons, links, focus rings, the
  active tab) — Fluent already colors these automatically once the theme's brand color changes, so
  this needs no per-component edits.
- Also hand-place the **orange** as a second accent, on the item-counter badges (tabs and sidebar
  filters) — the one clearly repeated small UI element the story's screenshots single out.
- Give the top bar a **branded dark background** (the dark navy) instead of the plain white/gray
  bar it has today.
- Fluent's official ramp-generator tool (the one that turns one color into the 16 shades Fluent's
  theme system needs) is not something I can run as a script. I generated an approximate 16-shade
  ramp myself from the blue (same hue, stepped lightness) — good enough for "visually attractive
  and consistent," which does not require an exact match to Microsoft's internal tool.

## Keep it simple

- **Not using the gray swatch.** It is close to Fluent's own neutral gray tokens, which every
  component already uses. No separate change needed.
- **Not recoloring the "needs review" badge.** It already uses Fluent's built-in "warning" color,
  which is a different, existing meaning (a data-quality flag, not a brand accent). Mixing it with
  the new orange accent would blur that meaning.
- **Not giving the top bar a different background per theme.** One fixed dark navy background,
  used the same way in light and dark mode, is simpler than two colors to maintain and still reads
  as "branded" either way.
- **Not touching the top bar's existing `role="heading"` button pattern.** It is a pre-existing,
  separate concern from coloring; out of scope here.

## AC coverage

| AC | Status | Where |
|---|---|---|
| The application looks visually attractive and the color scheme is internally consistent | covered | Tasks 1–4 (one brand ramp drives every Fluent control; the same orange accent and navy top-bar color are used everywhere they apply) |
| Dark theme and light theme are supported | covered | Task 1 (both themes are built from the same brand ramp) + Testing recommendations (verify both) |

## Implementation approach

1. Add one new file, `src/services/theme/brandPalette.ts`, holding the sampled colors and the
   generated 16-shade brand ramp as plain constants. This is the single source other files import
   from — no color literal is repeated across files.
2. Swap `webLightTheme`/`webDarkTheme` for Fluent's `createLightTheme`/`createDarkTheme` (from
   `@fluentui/react-components`) fed with the new ramp, in both places a theme is built:
   `ThemeProvider.tsx` (the real app) and `harness.tsx` (the mock-data harness used for
   screenshots and Playwright — see `.claude/rules/testing.md`). Skipping the harness would leave
   the screenshot evidence showing the old colors.
3. Recolor the top bar's background to the dark navy, and its text/icons to Fluent's
   `colorNeutralForegroundOnBrand` token — a token Fluent already ships for exactly this case
   (light text on a colored bar, correct in both themes).
4. Recolor the item-counter badges (`CounterBadge` in `CustomerTabs.tsx` and `SidebarFilters.tsx`)
   from Fluent's default "informative" color to the orange/near-black pair, the same way in both
   places.

## Task breakdown

1. **Create `src/services/theme/brandPalette.ts`.**
   Export the 16-shade `BrandVariants` ramp Fluent's theme functions need, plus three named
   constants: `topBarBackground` (`#083C5D`), `accentBadgeBackground` (`#D98310`), and
   `accentBadgeForeground` (`#1D2731`). Put the ramp values below in the file as-is (already
   generated from the blue swatch):

   | Shade | Hex |
   |---|---|
   | 10 | `#040C11` |
   | 20 | `#071821` |
   | 30 | `#0B2432` |
   | 40 | `#0F3043` |
   | 50 | `#123B54` |
   | 60 | `#164764` |
   | 70 | `#1A5375` |
   | 80 | `#1E5F86` |
   | 90 | `#23719F` |
   | 100 | `#2983B8` |
   | 110 | `#2E95D1` |
   | 120 | `#50A6D8` |
   | 130 | `#71B7E0` |
   | 140 | `#9BCCE9` |
   | 150 | `#C5E1F2` |
   | 160 | `#EAF4FA` |

   *(Revised during code review: the first version of this ramp was not ordered dark to light —
   shade 80 was lighter than shade 90 — and its shade 80 had only ~3.6:1 contrast against white
   text, below the 4.5:1 WCAG AA minimum Fluent's own stock theme meets at that shade. This
   version is strictly dark-to-light and shade 80 has ~6.9:1 contrast against white.)*

   Rule: `.claude/rules/frontend-architecture.md` — this is a small shared, non-colocated helper
   (used by `ThemeProvider.tsx` and `harness.tsx`), so it belongs under `services/`, next to the
   existing `services/theme/themeService.ts`, not inside one component's folder.

2. **Update `src/components/ThemeProvider/ThemeProvider.tsx`.**
   Replace the `webDarkTheme, webLightTheme` import with `createDarkTheme, createLightTheme` from
   `@fluentui/react-components`, and the `brandPalette` ramp from task 1. Change the
   `themeToken` calculation from `themeMode === 'dark' ? webDarkTheme : webLightTheme` to
   `themeMode === 'dark' ? createDarkTheme(brandRamp) : createLightTheme(brandRamp)`.
   Rule: `.claude/rules/frontend-architecture.md` (derived value computed with `useMemo` during
   render — already the pattern here, keep it).

3. **Update `src/harness.tsx`.**
   Same swap as task 2: `createLightTheme(brandRamp)` / `createDarkTheme(brandRamp)` in place of
   `webLightTheme` / `webDarkTheme`, so the screenshot/E2E harness renders the real new colors.
   Rule: `.claude/rules/testing.md` — screenshots are mandatory evidence for a UI change and must
   go through this harness, so it has to show the real theme.

4. **Update `src/components/TopBar/TopBar.tsx`.**
   In the `root` style, change `backgroundColor` from `tokens.colorNeutralBackground1` to
   `topBarBackground` (from task 1), and drop the neutral-gray bottom border — it doesn't read
   against the navy. Add `color: tokens.colorNeutralForegroundOnBrand` to the `title` style, and
   add it to two new style rules for the display-name `Text` and the theme-toggle icon `Button`
   (currently unstyled, using ambient color) so both stay readable against the dark background.
   The title and the toggle are Fluent `Button`s, which set their **own** color on hover/press —
   so also override `:hover` and `:hover:active` on `title` and the toggle's style to the same
   `colorNeutralForegroundOnBrand`, or the text goes dark-on-dark on interaction (caught in code
   review). Leave the "Log out" button's `appearance="secondary"` as-is — it already has its own
   background independent of the bar.
   Rule: `.claude/rules/frontend-architecture.md`.

5. **Update `src/components/CustomerTabs/CustomerTabs.tsx` and
   `src/components/SidebarFilters/SidebarFilters.tsx`.**
   Fluent's `CounterBadge` `color` prop only accepts Fluent's own fixed set of names (it has no
   "custom hex" option), so drop `color="informative"` and instead pass a `className` that sets
   `backgroundColor: accentBadgeBackground` and `color: accentBadgeForeground` (from task 1).
   Apply the same className in both files so every counter badge in the app looks the same.
   Rule: `.claude/rules/frontend-architecture.md`.

## Considerations

- The `CounterBadge` recolor works by a consumer `className` overriding the component's own
  color styling — a standard, supported Fluent v9 pattern, but it is worth a quick look in the
  browser to confirm the override actually wins (see Testing recommendations).
- The harness's top-bar stand-in (a plain `<header>` in `harness.tsx`, separate from the real
  `TopBar`) will still look like the old neutral bar after this change. That is expected and
  already documented in `.claude/rules/testing.md`: the harness cannot stand in for the real,
  MSAL-gated `TopBar`. The navy top bar needs a manual check in the real running app instead (see
  Definition of done).

## Testing recommendations

- **Altitude:** this is a purely visual change with no new logic, so no new Vitest unit test is
  needed for the color values themselves.
- **Must-cover list:**
  - A malformed brand ramp (missing a shade) would crash `createLightTheme`/`createDarkTheme` at
    runtime. Add one small Vitest test on `brandPalette.ts` asserting the ramp object has all 16
    expected shade keys (`10`…`160`) — cheap, and it catches a typo before it reaches the browser.
- **Screenshots (required for this UI change, per `.claude/rules/testing.md`):** capture at least
  one screenshot through the harness (`/harness.html`) in light mode and one with `?state=dark`,
  showing the recolored buttons/active tab/counter badges. Save under
  `e2e/screenshots/124/light.png` and `e2e/screenshots/124/dark.png`, and reference both from the
  code PR description.
- **Live verification (needed — the harness cannot cover the top bar):** open the running app
  (`npm run dev`) signed in, and manually confirm the dark-navy top bar with readable title/name/
  icon text in both light and dark mode. This cannot be screenshotted through the harness (see
  Considerations), so it is a manual check before merge, not an automated one.

## Definition of done

- [ ] `brandPalette.ts` exports the 16-shade ramp and the three accent constants; a Vitest test
      confirms the ramp has all 16 shade keys.
- [ ] `ThemeProvider.tsx` and `harness.tsx` both build their light/dark theme from the same ramp.
- [ ] The top bar has a dark-navy background with readable title, display name, and toggle-icon
      text in both themes (confirmed live in the running app — not just in the harness).
- [ ] Every item-counter badge (customer tabs and sidebar filters) uses the same orange/near-black
      styling.
- [ ] Two screenshots (light and dark) are committed under `e2e/screenshots/124/` and linked from
      the code PR.
- [ ] `npm run test`, `npm run build`, and lint all pass.

## Files/areas affected

- `src/services/theme/brandPalette.ts` (new)
- `src/services/theme/brandPalette.test.ts` (new)
- `src/components/ThemeProvider/ThemeProvider.tsx`
- `src/harness.tsx`
- `src/components/TopBar/TopBar.tsx`
- `src/components/CustomerTabs/CustomerTabs.tsx`
- `src/components/SidebarFilters/SidebarFilters.tsx`
- `e2e/screenshots/124/light.png`, `e2e/screenshots/124/dark.png` (new, added during implementation)
