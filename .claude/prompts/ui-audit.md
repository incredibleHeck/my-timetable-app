# UI/UX Audit & Redesign — EduScheduler Pro

## Role & Objective
Act as a Senior Product Designer and Staff Frontend Engineer. Perform an evidence-based
UI/UX audit of this app's front end, strip generic "AI slop" design tropes, and rebuild the
interface view-by-view into a clean, purposeful, high-craft product.

## Context: read the code, don't ask for it
You have full repo access. Read the source yourself — do NOT ask for pasted files. Start with:

- **Shell/layout:** `src/App.tsx`, `src/components/layout/{Sidebar,Header}.tsx`, `src/routing/ViewRouter.tsx`
- **Primitives:** `src/components/ui/` (Button, Card, Input, Select, Modal, Badge, Toast, ConfirmDialog, NumberStepper)
- **The 11 views:** DASHBOARD, CONFIG, SUBJECTS, TEACHERS, ROOMS, CLASSES, WORKLOAD,
  GENERATOR, EXAMS, DUTY, SUBSTITUTES (see `ViewState` in `src/types/index.ts`)
- **Theme/i18n:** `src/contexts/{ThemeContext,I18nContext}.tsx`, `src/i18n/dictionaries.ts`
- **Styling:** `src/index.css`, `tailwind.config.js`

Before proposing anything: run the app (`npm run dev`) and screenshot **every view in both
light and dark mode**. Audit what actually renders, not what you infer from source.

## Baseline measurements
Captured at commit `a68a6c2` (2026-08-03). **Re-run before trusting them** — they go stale:

```bash
grep -roE 'text-\[(8|9|10)px\]' src --include=*.tsx | wc -l   # tiny text (was 158, 44 files)
grep -ro 'text-slate-400' src --include=*.tsx | wc -l          # low-contrast microcopy (was 364)
grep -roE 'dark:[a-z-]+-[a-z0-9/]+' src --include=*.tsx | wc -l # dark variants (was 879)
grep -roE 'rounded-(xl|2xl)' src --include=*.tsx | wc -l       # card-ish containers (was 88)
grep -ro 'focus-visible' src --include=*.tsx | wc -l           # (was 5, vs 45 bare `focus:`)
```

Also true at that commit: **no design system exists** — `tailwind.config.js` `theme.extend`
is empty and every color is a hardcoded utility class.

> **Disclosure:** the ~879 `dark:` variants were mass-added by an automated sweep when dark
> mode was introduced (commit `68f531b`). They are self-inflicted, not organic decay.
> Collapsing them into semantic tokens is finishing that job properly — treat it as such,
> not as a discovery.

## Design philosophy
Human-centered, dense, functional, fast. This is a professional scheduling tool used all day
by school staff: favor information density, scannability, and speed over whitespace and
decoration. Form follows function.

## Suspected anti-patterns — VERIFY OR REJECT EACH
These are hypotheses from a quick pass, **not findings**. Confirm each against the running
app before acting, and say plainly when one does not hold:

1. **Card bloat** — most content wrapped in a rounded bordered card regardless of grouping value.
2. **Glow & gradient addiction** — Dashboard hero gradient plus arbitrary glow shadows.
3. **Empty metric grids** — Dashboard renders a 5-KPI row reading 0/0/0/0/0% on a fresh
   profile. Does it earn its place, or should it be actionable next-step state?
4. **Low-contrast microcopy** — heavy `text-slate-400` + sub-10px labels; check against WCAG AA.
5. **Cookie-cutter layouts** — the same `max-w-7xl mx-auto p-8` + card grid on every view
   regardless of the task it serves.

## Hard constraints (non-negotiable)
- **Stack:** React 18 + TypeScript + Tailwind + Vite + Tauri. No new dependencies without approval.
- **Dark mode parity:** every change must work in light AND dark (`darkMode: "class"`, ThemeProvider).
- **i18n:** all new/changed user-facing strings go through `t()` / `src/i18n/dictionaries.ts`.
- **Print:** don't break `print:hidden` or the A4 export path in `src/services/export/print.ts`.
  That file emits standalone HTML independent of app styles — its 8–10px type is correct for
  paper and is explicitly **out of scope** for the minimum-font rule below.
- **Out of scope — do not touch:** scheduler/solver (`src/features/generator/scheduler/**`),
  export services, storage layer. This is a UI/UX engagement only.
- **Accessibility:** WCAG AA contrast (4.5:1 body, 3:1 large text), no **on-screen** text below
  11px, visible `focus-visible` ring on every interactive element, preserve existing `aria-*`.

### Test coupling — read this before renaming anything
Both suites assert on literal rendered text, so IA/copy changes break them:
- **Unit** (`npm test`): e.g. `tests/header.test.tsx` expects `"Dashboard"`.
- **e2e** (`npm run test:e2e`, Playwright): `e2e/app.spec.ts` targets `"Welcome to EduScheduler Pro"`,
  `"Subject Library"`, `"Auto-Scheduler"`, `"10 Blocks"`, nav button names, and a `tab` role.

**Run e2e before you start** to establish a green baseline (it needs `npx playwright install
chromium` and is normally CI-only, so it may not have been run recently). Update selectors in
the same commit as any rename, and call out every change.

## Phase 1 — Audit & blueprint (NO implementation)
Use plan mode. Deliver:
1. **Evidence-based audit** — per view: what's wrong, cited as `file:line`, with screenshots.
   Explicitly separate *objectively broken* (a11y, contrast, dead UI, bugs) from *taste*.
2. **IA & navigation** — the sidebar has 11 items in 5 groups. Propose grouping/hierarchy
   justified against real task flow (setup → data entry → generate → daily operations).
3. **Design system foundation** — semantic tokens (surface/border/text/accent) in
   `tailwind.config.js` so the `dark:` variants collapse; type scale (eliminating sub-11px);
   spacing/density scale; and defined component states: default, hover, focus, active,
   disabled, loading, empty, error.
4. **Prioritized execution plan** — ordered by user impact ÷ regression risk. State which
   views you would deliberately leave alone and why. Do NOT plan to redo all 11 in one pass.

Then STOP and get approval before writing any UI code.

## Phase 2 — Implementation (one view per iteration)
- Tokens and shared primitives first, then views in priority order.
- Edit files directly — don't paste large code blocks for manual copying.
- One view per commit on a feature branch. After each: typecheck, lint, format:check, unit
  tests, **e2e**, build, plus browser screenshots in both themes. Report before/after.
- After the FIRST view, stop and check in so direction can be calibrated before continuing.

## Definition of done
- 0 on-screen text below 11px; all body/microcopy passes WCAG AA contrast in both themes.
- Every interactive element has a visible `focus-visible` state.
- Color is applied via semantic tokens; per-element `dark:` overrides largely eliminated.
- Full suite green (typecheck, lint, format, unit, e2e, build) with no skipped tests.
- Every view screenshotted before/after in both themes.

## Honesty requirements
- If a suspected anti-pattern isn't actually present, **say so and drop it** — do not
  manufacture work to fill the checklist.
- Label subjective calls as taste and offer the alternative.
- If a change regresses something, say so plainly with the evidence.
- Report what was actually verified vs. assumed. Don't claim a view "works in dark mode"
  without having looked at it.
