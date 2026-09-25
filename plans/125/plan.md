# Plan — AB#125: Dark theme not working when page is loading

## Context

When a user has dark theme selected, the app still shows a light screen while it loads. Dark
theme only appears once loading finishes. This plan makes dark theme show right away, on the
very first loading screen.

**Found:** four things cause the light flash, in order:
1. `index.html` sets no background color, so the raw page is browser-white before React runs.
2. During Microsoft sign-in, `src/components/AuthLoading/AuthLoading.tsx` renders **outside**
   `FluentProvider` — `App.tsx` puts `MsalAuthenticationTemplate` above `ThemeProvider`
   (`src/App/App.tsx:46-58`), so the loading screen has no theme at all, light or dark.
3. `src/components/ThemeProvider/ThemeProvider.tsx` starts every session at a hardcoded
   `DEFAULT_THEME = 'light'` (line 13/23) and only switches to dark after an async fetch of the
   user's saved preference from OneDrive over Microsoft Graph (line 27-37). That fetch can only
   start after sign-in finishes, so it is always on the loading path.
4. Theme preference is never cached in the browser (`localStorage`) — only in OneDrive. So there
   is no way to know "this user picked dark" before that network round trip completes.

*(dev-seeded: no extra steering given — proceed on the codebase read above.)*

## Keep it simple

- **Non-goal: don't build a full offline-first settings layer.** We add one cached value
  (the theme mode) to `localStorage`, not a generic client-side cache for all preferences.
- **Non-goal: don't change how the preference is stored long-term.** OneDrive via Microsoft
  Graph stays the source of truth (`src/services/theme/themeService.ts`); `localStorage` is only
  a same-device shortcut so the *next* load can skip the flash.
- **Simpler option taken:** instead of teaching `AuthLoading`/`AuthError` to read theme on their
  own, we move `ThemeProvider` up so it wraps `MsalAuthenticationTemplate`. One provider, no
  duplicate theme logic.

## AC coverage

| AC | Status | Where |
|---|---|---|
| When loading the page, if dark theme is selected, it should be visible directly on the first loading screen. | covered | Tasks 1–3 below (returning device/browser); new-device first load is a decided exception, see *Assumptions & open questions* |

## Implementation approach

Two changes, both small and localized:

1. **Cache the theme mode in `localStorage`** so it is known synchronously, before any network
   call. `ThemeProvider` reads this cache for its *first* render instead of always starting at
   `'light'`.
2. **Move `ThemeProvider` above `MsalAuthenticationTemplate`** in `App.tsx`, so the sign-in
   loading/error screens render inside `FluentProvider` too, and pick up the cached theme like
   the rest of the app.

No new dependencies. Everything needed already exists in
`src/components/ThemeProvider/` and `src/services/theme/`.

## Task breakdown

1. **Add a `localStorage` cache to the theme service.**
   File: `src/services/theme/themeService.ts` (existing service, already does the Graph
   read/write — this is the same kind of I/O, just a different store).
   - Add `getCachedThemeMode(): 'light' | 'dark' | null` — reads a single key (e.g.
     `themeMode`) from `localStorage`, returns `null` if absent or not one of the two valid
     values (never throws).
   - Add `setCachedThemeMode(mode: 'light' | 'dark'): void` — writes that key.
   - Rule: `.claude/rules/frontend-architecture.md` (pure I/O helper stays in the service
     layer, not colocated in a component).

2. **Use the cache for the first render in `ThemeProvider`.**
   File: `src/components/ThemeProvider/ThemeProvider.tsx`.
   - Change the initial `useState` (currently hardcoded `DEFAULT_THEME`, line 13/23) to a lazy
     initializer: `useState(() => getCachedThemeMode() ?? DEFAULT_THEME)`. This makes the very
     first render already dark for a returning user, with no wait on Graph.
   - When the Graph fetch (line 27-37) resolves, keep calling `setThemeMode` as today, and also
     call `setCachedThemeMode(fetched)` so the cache stays correct if the user changed the
     preference on another device.
   - In `toggleTheme` (line 39-51), call `setCachedThemeMode(newMode)` alongside the existing
     `saveThemePreference` call, so the cache and OneDrive never disagree.
   - Rule: `.claude/rules/authentication.md` (no change to scopes — this only adds a client-side
     cache in front of the existing `Files.ReadWrite`-scoped Graph call, it does not add a new
     scope or call Graph any differently).

3. **Wrap the sign-in loading/error screens in the theme provider.**
   File: `src/App/App.tsx`.
   - Reorder so `ThemeProvider` is the **outer** component and `MsalAuthenticationTemplate`
     (with its `loadingComponent={AuthLoading}` / `errorComponent={AuthError}`, lines 46-50) is
     its child, instead of the reverse. The rest of the tree under `MsalAuthenticationTemplate`
     is unchanged.
   - Rule: `.claude/rules/frontend-architecture.md` ("A cross-cutting UI concern has a single
     owner" — this keeps theme as the one outer concern instead of adding a second unthemed code
     path for the loading/error states).

## Assumptions & open questions

- None remaining — see the decided item below.

**Decided in planning with the dev:** the `localStorage` cache (Task 1–2 above) *is* the
first guess, kept in sync with the OneDrive preference. On a brand-new device/browser, with no
cached value yet, a one-time light flash is accepted — there is no earlier signal available, and
the AC concerns a user returning to a device that already knows their choice.

## Considerations

- `index.html`'s plain white background is still the very first pixel painted, for a few
  milliseconds before any JS runs, on every load (cached or not). This is a browser-level
  constraint (no CSS can run before the stylesheet/JS loads) and is not something this plan can
  remove — call it out here rather than treat it as an open question, since there is no
  alternative implementation that avoids it.
- `localStorage` is per-browser, not per-account. If two different users sign in on the same
  browser, the second one may briefly see the first one's cached theme before their own Graph
  preference loads. This matches how the rest of the app already behaves with cached UI state,
  and self-corrects within one render once the fetch for the new account resolves.

## Testing recommendations

The project uses Vitest for unit tests (`.claude/rules/testing.md`).

- **Altitude:** unit tests on `ThemeProvider` and the new `themeService` cache helpers — no new
  Playwright coverage needed, since this is a timing/initial-state fix rather than a new screen
  or layout.
- **Must-cover list:**
  - `getCachedThemeMode` with no stored value → returns `null`, not an error.
  - `getCachedThemeMode` with a stored value of `'dark'` → returns `'dark'`.
  - `getCachedThemeMode` with a corrupted/unexpected stored value → returns `null` (never crashes).
  - `ThemeProvider` mounted with a cached `'dark'` value → its *very first* render already uses
    the dark theme, before the mocked Graph fetch promise resolves (this is the regression test
    for the bug itself).
  - `toggleTheme` → the new cache value matches what was saved to OneDrive.
- **Live verification:** this bug is inherently visual (jsdom cannot see the flash). Add to
  Definition of done: after implementing, reload the app in a real browser with dark theme
  already selected and confirm the sign-in loading screen and first paint are dark, not light.

## Definition of done

- [ ] `getCachedThemeMode()` / `setCachedThemeMode()` added to `themeService.ts` and unit-tested
      for the empty, valid, and corrupted cases.
- [ ] `ThemeProvider`'s initial state comes from the cache when present, verified by a unit test
      that does not await the Graph fetch.
- [ ] `toggleTheme` and the post-fetch update both keep the cache in sync with OneDrive.
- [ ] `App.tsx` renders `ThemeProvider` above `MsalAuthenticationTemplate`, so `AuthLoading` /
      `AuthError` render inside `FluentProvider`.
- [ ] Manually verified in a real browser: with dark theme already selected, reloading the app
      shows dark immediately, including on the sign-in loading screen.
- [ ] `npm run test` passes; `npm run lint` clean.

## Files/areas affected

- `src/services/theme/themeService.ts` (new cache helpers + tests)
- `src/components/ThemeProvider/ThemeProvider.tsx` (lazy initial state, cache writes)
- `src/App/App.tsx` (provider order)
