# EduScheduler Pro

A desktop and web application for school timetable management — class scheduling, exam logistics, and duty assignments. Built with React, TypeScript, Vite, and Tauri.

## Prerequisites

- Node.js 20+
- npm 10+
- (Desktop only) [Rust](https://www.rust-lang.org/tools/install) and platform-specific Tauri dependencies

## Setup

```bash
git clone <repo-url>
cd my-timetable-app    # repo folder name may differ
npm ci                 # always use ci — do not copy node_modules across OS/WSL
cp .env.example .env   # optional — only needed for external tooling keys
```

If you see an esbuild platform error after cloning or switching machines, delete `node_modules` and run `npm ci` again.

## Development

```bash
# Web mode (browser)
npm run dev

# Desktop mode (Tauri)
npm run tauri dev
```

Open http://localhost:5173 in the browser for web mode.

## Build

```bash
# Web production build
npm run build

# Desktop installer
npm run tauri build
```

Output goes to `dist/` (web) or `src-tauri/target/release/` (desktop).

## Testing

```bash
npm test              # run all unit tests once
npm run test:coverage # run tests with coverage report
npm run test:e2e      # Playwright end-to-end tests (web mode)
npm run typecheck     # TypeScript check (src + tests)
npm run lint          # ESLint
npm run format:check  # Prettier check
npm run diagnostics:smoke  # Scheduler smoke test (scripts/diagnostics/)
```

CI runs lint, format, typecheck, unit tests with coverage, build, and Playwright E2E on every push/PR. Tauri desktop builds run on push to `main` only (see `.github/workflows/ci-tauri.yml`).

### Manual test checklist

After setup, verify these core flows:

1. **Profiles** — create, switch, auto-save, reload persistence
2. **Import/export** — dashboard backup import/export; confirm exam rosters and duty rosters survive round-trip
3. **Configuration** — change periods per day; confirm reservations grid and time labels update
4. **Academic data** — add subjects, teachers, rooms, classes with curriculum
5. **Generator** — generate schedule, drag-and-drop edit, undo/redo, export Excel/PDF
6. **Exams & duty** — create rosters, auto-assign, export
7: **Edge cases** — double-period swaps, same-day load limits, fixed occasion blocks
8. **Activation Gate** — verifies dummy product key (EDU-XXXX-XXXX-XXXX) on cold start

## Project structure

```
src/
  features/       # Feature modules (dashboard, generator, exams, duty, activation)
  components/     # Shared UI (layout, buttons, modals, toasts)
  contexts/       # React context (profiles, undo/redo)
  services/       # File system, export, profile storage
  types/          # Shared TypeScript types
tests/            # Vitest test suite (86 files, 308 tests)
src-tauri/        # Tauri desktop shell (Rust)
conductor/        # Internal planning docs (not required to run the app)
```

## Tech stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Desktop:** Tauri v2
- **Exports:** ExcelJS (lazy-loaded), react-to-print
- **Testing:** Vitest, React Testing Library

## Troubleshooting

| Problem | Fix |
|---------|-----|
| esbuild platform mismatch | Delete `node_modules`, run `npm ci` on the current OS (don't copy node_modules from WSL/Docker) |
| Tests fail after dependency update | `npm ci` then `npm test` |
| Blank screen in Tauri dev | Ensure Vite is running on port 5173 before the Tauri window opens |

## Environment variables

Copy `.env.example` to `.env` and fill in values as needed. Never commit `.env` to version control.
