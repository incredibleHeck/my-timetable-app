# Hardening Plan — Remaining Work

Updated 2026-08-07. Completed items have been removed; everything below is
outstanding and verified as such by running the toolchain.

Current tree: typecheck, lint, format, and build clean. **582 unit tests pass**
across 122 files. **E2E is 20/20, `npx playwright test` exits 0.**
`npm audit --omit=dev` clean. Coverage floors at 77/74/62/59 and holding.

## Findings still open

| #   | Finding                                                                                                                                                     | Evidence                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| R1  | **The leaked API key has not been revoked.** It is gone from the project, but removal is not revocation — the value is still in git history and live at the provider | committed at `aa1010d`; `git log --all -p -- .env` |
| R2  | **Four data-mutating modules are barely tested.** `ProfileContext` 28% branch, `useManualPlacement` 0%, `ExamManualModal` 12%, `useDndLogic` 54%              | `npm run test:coverage`                         |
| R3  | **Coverage measures only part of `src`.** `components/`, `schemas/`, `utils/`, `hooks/` and `routing/` are outside the denominator entirely                   | `vite.config.ts` → `coverage.include`           |
| R4  | **Eight dependencies are held a major behind.** Deliberate, but they will not age well                                                                       | React 19, TypeScript 7, Tailwind 4, zod 4, jsdom 29, vite 8, lucide-react 1.x, react-to-print 3 |

## On coverage targets

The previous revision of this plan set a 65% branch-coverage target. **That number
was arbitrary** — a round figure above where the project happened to sit — and it
has been dropped.

Two things replace it:

1. **The ratchet stays.** The floors in `vite.config.ts` exist to stop regression,
   which is the job a coverage number is actually good at. Raise them when the
   numbers improve; never lower them to make a build pass.
2. **Target files, not percentages.** Every substantive bug this audit found lived
   in a branch that a percentage would not have prioritised — the `??` default in
   `parseProfile`, the swallowed `catch` in `loadProfile`, the hardcoded stamp in
   `migration.ts`, the `> 85` / `> 100` boundaries in the workload export.

The sharpest illustration is R3: `schemas/profile.ts` — where the most dangerous
bug in this audit lived — is **outside the coverage denominator**. The number
could reach any value at all with that bug still in place.

---

## Phase A — Revoke the key (R1)

The key is gone from the project: `.env` and `.env.example` deleted, the
`context7` MCP server removed from `.gemini/settings.json`, README references
dropped, and a CI guard added that fails when a gitignored file is tracked.

**The one step that actually remediates it cannot be done from inside this repo:**

- **Revoke `CONTEXT7_API_KEY` in the Context7 account.** Deleting the file does
  not unpublish the value. No replacement is needed — nothing uses it.

**Exit:** the provider reports the key revoked. The value remains in git history,
and that is expected — revocation is the remediation, not history rewriting.

**Size:** minutes, all of it at the provider.

---

## Phase B — Test what can lose data (R2, R3)

Time-boxed to **two days**. Stop when the box closes, whatever the percentage
says.

First, widen `coverage.include` to `src/**` and re-baseline. The headline number
may move in either direction; the point is that `schemas/` and `components/` stop
being invisible.

Then these four, chosen because each can destroy a user's work:

| file                     | branch % | why it matters                                                    |
| ------------------------ | -------- | ----------------------------------------------------------------- |
| `ProfileContext.tsx`     | 28.57    | autosave, profile switching, emergency flush — the durability core |
| `useManualPlacement.ts`  | 0        | entirely untested, and it mutates the timetable                    |
| `ExamManualModal.tsx`    | 11.84    | near-zero on a data-entry surface                                  |
| `useDndLogic.ts`         | 54.18    | drag-drop mutation — where lessons go missing                      |

`SubstitutesView` went 24% → 97% branch in one sitting and is the pattern to
copy: render the real component, drive it with `userEvent`, assert what the user
sees, and deliberately cover the empty / singular / boundary / no-candidate
edges rather than the happy path.

Raise the floors when the numbers land. Do not chase the long tail — past roughly
75–80% branch on a view component you are mostly testing React.

---

## Phase C — Dependency majors (R4)

**Recommendation: leave these alone for now.** `npm audit` is clean, so there is
no security pressure and no forcing function. React 19 drags `@types/react`,
`@types/react-dom` and `@vitejs/plugin-react` with it; Tailwind 4 is a config
rewrite; TypeScript 7 and vite 8 are their own migrations.

When they are picked up, treat each as its own change with its own verification,
never as a batch.

---

## Deferred

### Desktop delivery — updater and code signing

Deferred by decision. The app currently ships with **no update path and no code
signing**: a released installer cannot be patched, and unsigned builds trip
SmartScreen on Windows and Gatekeeper on macOS.

The inert updater config was reverted rather than half-wired — an empty `pubkey`
with no Rust-side plugin was decoration, and initialising it partially would have
turned a silent no-op into a runtime failure.

Doing it properly means all of:

- `tauri-plugin-updater` in `Cargo.toml`; initialise it in `lib.rs`.
- `updater:default` in `capabilities/default.json`.
- Generate the keypair (`tauri signer generate`); public key in config, private
  key as a CI secret.
- `createUpdaterArtifacts` in the bundle config; endpoint pointing at the real
  repository (`incredibleHeck/my-timetable-app`).
- Publish `latest.json` plus signed artifacts from `ci-tauri.yml` on tag push.
- An in-app check with an explicit user-consented install step.
- Parameterise `ci-tauri.yml` for Windows and macOS signing secrets, skipping
  cleanly when absent so unsigned dev builds keep working.

**Worth starting early:** code-signing certificates carry external lead time —
identity verification can take a week or more. That paperwork can begin at any
point without writing a line of code, and it gates the whole phase.

**Size when picked up:** 3–4 days, plus certificate lead time.

### Activation

Out of scope by decision — the app should stay freely runnable during
development.

`src/hooks/useActivation.ts` validates a regex (`EDU-XXXX-XXXX-XXXX`) and writes
to `localStorage`. Any conforming string unlocks the app; clearing storage is the
crack. `LICENSE` and `CHANGELOG.md` both describe it as a real gate — correct the
changelog wording when this lands, not before.

When picked up it needs a license-issuing service, online activation with offline
grace, machine binding, revocation, and a story for schools behind a proxy.

**Until then:** leave the stub visibly a stub. Do not partially harden it.

### Localisation

Settled: the app is English-only. The half-wired i18n harness has been deleted
and its ~30 keys inlined at their call sites. If localisation is ever wanted it
starts from scratch, not from that scaffold.

---

## Standing conventions

Each learned the hard way:

- **Anchor E2E on `data-testid`, never on headings or body copy.** The suite was
  silently red for weeks because `335d1a1`, `c8f33c8` and `ef5c750` removed the
  page titles it keyed on.
- **Check Playwright's exit code directly.** Piping to `tail` returns `tail`'s
  status, which is how six failing tests once looked like a pass.
- **After bumping `@playwright/test`, run `npx playwright install`.** Browser
  binaries are version-pinned; without it every browser test fails at launch.
- **Never inline the private fixture into a committed spec.**
  `e2e/real-world-scale.spec.ts` reads it off disk at run time and skips when
  absent, so real staff data stays out of git and out of CI.
- **Parsing is not migrating.** No code path may stamp a profile with the current
  schema version unless the migration chain ran. Enforced by test.

---

## Sequencing

```
A  ──┬──────────────────  revoke key            minutes
     ├── B ──────  test what can lose data      2 d, time-boxed
     └── C ──────  dependency majors            deferred, no pressure
```

Phase A first and alone. B is the only active engineering work. C waits.

Meanwhile, if shipping is the goal, the certificate paperwork under **Desktop
delivery** is the item with external lead time and no code cost — starting it
early costs nothing and unblocks the longest pole.

## Definition of done

- The leaked key is revoked at the provider.
- The four data-mutating modules in Phase B are covered.

Beyond that, what separates this from a sellable product is entirely in the
deferred section: a real activation system, and signed installers that can update
themselves.
