# EduScheduler Pro — Development Architecture & Guidelines

**Version:** 2.0 (Post-CDN-Migration)  
**Last Updated:** December 26, 2025  
**Maintained By:** Lead Developer

---

## Table of Contents

1. [Project Context](#1-project-context-immutable-truth)
2. [Operational Rules](#2-operational-rules)
3. [Missing Context Protocol](#3-missing-context-protocol-critical)
4. [Common Tasks & Workflows](#4-common-tasks--workflows)
5. [Build & Deployment](#5-build--deployment)
6. [Testing & Validation](#6-testing--validation)
7. [Known Issues & Limitations](#7-known-issues--limitations)
8. [Code Review Checklist](#8-code-review-checklist)
9. [Communication Template](#9-communication-template)
10. [Glossary & Key Terms](#10-glossary--key-terms)
11. [File Modification Checklist](#11-quick-reference-file-modification-checklist)
12. [Final Reminders](#12-final-reminders)

---

## 1. PROJECT CONTEXT (IMMUTABLE TRUTH)

### Executive Summary

**EduScheduler Pro** is a client-side React 18 application enabling schools to manage resources (subjects, teachers, classes) and generate conflict-free timetables using a heuristic solver.

- **Stack:** React 18 (Vite), TypeScript, Tailwind CSS (local build), ExcelJS, react-to-print
- **State Management:** Centralized in `src/App.tsx`, passed via props. No Redux/Context API.
- **Backend:** None. Pure client-side with localStorage persistence.
- **Deployment:** Single-page application (SPA).

### Technology Stack Details

```json
{
  "Runtime": "Vite + TypeScript 5+",
  "UI Framework": "React 18.2.0",
  "Styling": "Tailwind CSS 3.4.1 (local, processed via PostCSS)",
  "Icons": "lucide-react 0.300.0",
  "Exports": "ExcelJS 4.4.0 + file-saver 2.0.5",
  "Printing": "react-to-print 2.14.15",
  "Type Safety": "TypeScript strict mode enabled"
}
```

### Architecture Overview

#### Directory Structure (CANONICAL)

```
src/
├── main.tsx                    # App bootstrap + Tailwind import
├── index.css                   # Tailwind directives (@tailwind)
├── App.tsx                     # Root component + global state + routing
│
├── types/
│   └── index.ts                # ⭐ SINGLE SOURCE OF TRUTH for all data models
│
├── services/
│   ├── scheduler/              # Heuristic solver for timetable generation
│   │   ├── index.ts            # Main export
│   │   ├── solver.ts           # Core allocation algorithm
│   │   ├── preparation.ts      # Curriculum → AllocationUnits conversion
│   │   ├── heuristics.ts       # Priority scoring logic
│   │   ├── types.ts            # Solver-specific types
│   │   └── utils.ts            # Helper functions (period type, next class period, etc.)
│   └── fileSystem.ts           # Abstraction for save/load (Tauri + Web)
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Top navigation + profile switcher
│   │   └── Sidebar.tsx         # Left navigation + brand
│   └── ui/
│       ├── index.ts            # Export barrel
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       └── Badge.tsx
│
├── features/
│   ├── dashboard/
│   │   ├── DashboardView.tsx   # Home + quick stats + health checks
│   │   └── hooks/
│   │       └── useDashboard.ts
│   │
│   ├── configuration/
│   │   ├── GlobalConfigView.tsx # Period structure, timings, school identity
│   │   └── hooks/
│   │       └── useGlobalConfig.ts
│   │
│   ├── subjects/
│   │   └── SubjectsView.tsx    # Subject CRUD + color palette + single-resource flag
│   │
│   ├── teachers/
│   │   ├── TeachersView.tsx    # Teacher directory + faculty assignments
│   │   ├── TeacherEditorModal.tsx
│   │   └── hooks/
│   │       └── useTeacherManagement.ts
│   │
│   ├── classes/
│   │   ├── ClassesView.tsx     # Class CRUD + curriculum matrix
│   │   ├── ClassEditorModal.tsx # Supports class-specific overrides
│   │   └── GroupModals.tsx     # Joint classes + elective blocks
│   │
│   ├── workload/
│   │   └── WorkloadView.tsx    # Teacher utilization analysis
│   │
│   └── generator/
│       ├── GeneratorView.tsx   # Main scheduler UI + print/export
│       ├── components/
│       │   ├── ScheduleGrid.tsx       # Grid display for class/teacher schedules
│       │   ├── DraggableSlot.tsx      # Drag-and-drop slot component
│       │   └── ConflictPanel.tsx      # Displays unscheduled lessons
│       └── hooks/
│           ├── useDragAndDrop.ts      # Drag-and-drop logic
│           └── useScheduleSwap.ts     # Slot swapping logic
│
└── utils/
    ├── constants.ts            # Color palette, defaults, day names
    ├── excelExport.ts          # Multi-sheet Excel workbook generator
    └── utils.ts                # ID generation, date formatting
```

### Core Data Models

**Settings (Global Configuration)**

- `periodsPerDay`: Number of teaching slots per day
- `dayStructure`: Array of `PeriodConfig` (CLASS, BREAK, LUNCH)
- `fixedOccasions`: 2D array `[day][period]` for global events (e.g., Assembly)
- `schoolName`, `academicYear`: Institution metadata
- `timeSlots`: `{ start, end }` array for each period
- `maxConsecutivePeriods`: Fatigue guard (max 4 classes in a row)
- Duration defaults: `defaultClassDuration`, `defaultBreakDuration`, `defaultLunchDuration`

**Subject**

- `id`, `name`, `color`: Basic metadata
- `isSingleResource`: Boolean flag (e.g., ICT Lab—only 1 class can use it per period)

**Teacher**

- `id`, `name`, `specialtyIds`: Linked subjects
- `constraints`: 2D array `[day][period]` of boolean (true = blocked)

**ClassGroup**

- `id`, `name`, `periodCount`, `duration`
- `curriculum`: Array of `CurriculumItem` (subject, periods/week, single/double slots)
- `structure`: Optional class-specific period override (replaces global `dayStructure`)
- `fixedSessions`: Optional class-specific events `[day][period]`

**Schedule & Conflicts**

- `ScheduleSlot`: `{ subjectId, teacherId, classId, isFixed }`
- `ScheduleResult`: `Record<classId, Record<day, Record<period, ScheduleSlot>>>`
- `Conflict`: Unscheduled lesson with reason (teacher blocked, class unavailable, etc.)

**AppData (Complete Application State)**

```typescript
{
  settings: Settings,
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  jointClasses: JointClass[],        // Multi-class subjects (e.g., Grade 12 Math)
  electives: ElectiveBlock[],        // Optional subject groups
  schedule: ScheduleResult,
  conflicts: Conflict[],
  lastGenerated: ISO string | null
}
```

**Profile (Serializable State)**

- `id`, `name`, `data: AppData`
- Stored in localStorage + exported as JSON

---

## 2. OPERATIONAL RULES

### A. Code Generation Standards

#### 1. NO SHORTCUTS OR PSEUDO-CODE

- ❌ Never output `// ... existing code` or `// [rest of the file]`
- ✅ Output the **ENTIRE, COMPLETE, RUNNABLE FILE**
- Exception: Only use `// ...existing code...` in **file path comments** when modifying middle sections of 100+ line files, but still provide full context.

#### 2. Type Safety

- Strict TypeScript mode enabled (`"strict": true` in tsconfig.json)
- ❌ No `any` types. No `as unknown as Type` casts.
- ✅ Use proper unions, generics, and interface composition
- ✅ Import all types from `src/services/scheduler/index.ts`

#### 3. Styling Rules

- ❌ No inline CSS or styled-components
- ✅ Tailwind classes only
- ✅ Responsive: mobile-first with `md:`, `lg:` breakpoints
- Print styles: Use `print:` classes (e.g., `print:hidden`, `print:block`)

#### 4. Component Patterns

- Props as interfaces (e.g., `interface Props { data: AppData; ... }`)
- Use `React.FC<Props>` explicitly
- Destructure props in signature: `const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => { ... }`
- Use `useMemo`, `useCallback` for expensive operations
- Avoid prop drilling; pass via context if 3+ levels deep

#### 5. NO NEW DEPENDENCIES

- ❌ Do not suggest `npm install` unless absolutely critical
- Current stack is complete for core features
- If external library needed, justify with technical reason

#### 6. File Organization

- UI logic: `features/` or `components/`
- Heavy algorithms: `services/`
- Constants & helpers: `utils/`
- Types: Always in `src/services/scheduler/index.ts`

---

### B. State Management

#### Flow:

1. User interacts with feature component
2. Component calls `onUpdate(newData: AppData)`
3. Callback propagates to `src/App.tsx`
4. `src/App.tsx` updates state + saves to localStorage
5. New state cascades back down as props

#### Key Points:

- No mutations. Always use spread operator: `{ ...data, settings: { ...data.settings, ... } }`
- `generateSchedule(data)` is a pure function—call it in `GeneratorView` only
- Undo/Redo: Not implemented. Implement via state snapshots in localStorage if needed.

---

### C. Scheduler Logic (Critical Domain)

#### Entry Point: `src/services/scheduler/index.ts`

```typescript
export const generateSchedule = (data: AppData)
  => { schedule: ScheduleResult; conflicts: Conflict[] }
```

#### Flow:

1. **Preparation** (`src/services/scheduler/preparation.ts`): Convert curriculum into `AllocationUnit[]`

   - Each unit = one subject assignment to a class + teacher + period count
   - Sort by priority (single classes first, teachers with constraints, etc.)

2. **Solving** (`src/services/scheduler/solver.ts`): Greedy allocation with backtracking

   - For each unit (in priority order), find available `[day, period]` slot
   - Check: period type matches, teacher free, class free, no single-resource conflicts
   - If no slot found → add to `conflicts[]`

3. **Heuristics** (`heuristics.ts`): Priority scoring
   - Single-period > double-period (easier to fit)
   - Constrained teachers > flexible teachers
   - Full classes > partial classes

#### Solver State:

- `teacherOccupancy[tid][day][period]`: Boolean occupancy grid
- `classOccupancy[cid][day][period]`: Boolean occupancy grid
- `singleResourceUsage[subjectId][day][period]`: Track single-resource subjects

---

## 3. MISSING CONTEXT PROTOCOL (CRITICAL)

**You do NOT have access to file internals unless explicitly provided in the current chat.**

### Before You Code:

#### Step 1: Identify Required Files

- List all files you need to read/modify
- Check: Has the user pasted the code in this conversation?

#### Step 2: If Code NOT Provided

- **STOP.** Do not guess or invent.
- Ask explicitly:

```
I need to examine the following files to provide accurate changes:
- [File 1]
- [File 2]

Please paste their current code so I can ensure my modifications are correct.
```

#### Step 3: If User Says "I'll describe it"

- ❌ Do not proceed without seeing actual code
- ✅ Insist: "Please paste the file so I can see exact syntax and imports."

#### Step 4: Exception: Trivial Additions

- If adding a new small component (< 50 lines) to a known structure, you may infer
- Still: Verify the interface contract with existing code

---

## 4. COMMON TASKS & WORKFLOWS

### Task: Add a New Subject Field (Example)

**Steps:**

1. Update `src/services/scheduler/index.ts` → `Subject` interface
2. Update `src/features/subjects/SubjectsView.tsx` → Add input field
3. Update `src/utils/constants.ts` → DEFAULT_DATA if needed
4. Update any dependent features (e.g., `ScheduleGrid` if it displays subject metadata)

**Before coding:** Ask for the current `src/services/scheduler/index.ts` and `src/features/subjects/SubjectsView.tsx` if not pasted.

---

### Task: Fix a Scheduler Bug

**Process:**

1. Reproduce with minimal test data
2. Add `console.log()` at key checkpoints in `src/services/scheduler/solver.ts`
3. Verify `AllocationUnit` preparation is correct
4. Check occupancy grid logic
5. Review conflict classification

---

### Task: Add a Print Template

**Process:**

1. Create new component in `features/generator/components/` (e.g., `PrintHeader.tsx`)
2. Use Tailwind `print:` classes for print-specific styling
3. Import in `src/features/generator/GeneratorView.tsx`
4. Wrap with `useReactToPrint()` → Already integrated

---

## 5. BUILD & DEPLOYMENT

### Development

```bash
npm install              # Install deps (includes Tailwind locally)
npm run dev             # Vite dev server (fast refresh enabled)
```

### Production Build

```bash
npm run build           # TypeScript check + Vite build → dist/
npm run preview         # Preview optimized build locally
```

### Vite Config (`vite.config.ts`)

- React Fast Refresh enabled
- No special plugins needed (Tailwind via PostCSS)

### Tailwind Integration

- **Source:** `src/index.css` with `@tailwind` directives
- **Config:** `tailwind.config.js` (content pattern includes all JSX files)
- **Processing:** PostCSS (`postcss.config.js`) handles compilation

### Key Configuration Files

**`tailwind.config.js`**

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**`postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**`src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`src/main.tsx`** (imports Tailwind)

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 6. TESTING & VALIDATION

### Manual Testing Checklist

- [ ] Create a profile with 2 classes, 3 subjects, 2 teachers
- [ ] Assign curriculum (e.g., Class A: 3 periods/week English, 2 periods/week Math)
- [ ] Set teacher constraints (e.g., Teacher X unavailable Mon/Fri afternoons)
- [ ] Generate schedule → Should produce 0 conflicts
- [ ] Modify a slot (drag/drop) → State updates correctly
- [ ] Print schedule → Layout is clean, no UI elements leak
- [ ] Export to Excel → File downloads, data is correct
- [ ] Refresh browser → State persists from localStorage

### TypeScript Validation

```bash
npx tsc --noEmit        # Check for type errors (no emit)
```

---

## 7. KNOWN ISSUES & LIMITATIONS

| Issue            | Status             | Notes                                                                                                      |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| PDF Generation   | ⏳ In Progress     | Using `react-to-print` (browser print dialog), not direct PDF export. Remove `timetablePDF.tsx` if exists. |
| Undo/Redo        | ❌ Not Implemented | Implement via state snapshots in localStorage if needed.                                                   |
| Concurrent Edits | N/A                | Single-user, client-side only. No sync needed.                                                             |
| Large Datasets   | ⚠️ Slow            | Solver is O(n²) for 100+ classes. Optimize if needed.                                                      |
| Mobile UI        | ⚠️ Limited         | Sidebar collapses on mobile. Generator view may be cramped.                                                |

---

## 8. CODE REVIEW CHECKLIST

Before submitting any code, verify:

- [ ] **Types:** All variables and props properly typed. No `any`.
- [ ] **Imports:** Correct paths. All types from `src/services/scheduler/index.ts`.
- [ ] **Styling:** Tailwind only. Responsive breakpoints included.
- [ ] **State:** Immutable updates. No direct mutations.
- [ ] **Performance:** `useMemo` for expensive calcs. No inline functions in render.
- [ ] **Accessibility:** Semantic HTML. ARIA labels for icons.
- [ ] **File Completeness:** Entire file pasted, not snippets.
- [ ] **Consistency:** Matches existing code style and patterns.

---

## 9. COMMUNICATION TEMPLATE

When the user requests a feature or fix:

### Step 1: Clarify

```
I understand you want to [feature]. Let me confirm:
- [Clarification 1]
- [Clarification 2]

Is this correct?
```

### Step 2: Request Context

```
To implement this accurately, I need the current code for:
- [File A]
- [File B]

Please paste them so I can ensure compatibility.
```

### Step 3: Provide Solution

```
Here's the updated code for [File]:
[FULL FILE]

**Changes Made:**
- [Change 1]
- [Change 2]

**Testing:** [Steps to verify]
```

---

## 10. GLOSSARY & KEY TERMS

| Term                        | Definition                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------- |
| **AllocationUnit**          | A curriculum assignment ready for scheduling (subject + class + teacher + periods). |
| **ScheduleSlot**            | Single cell in timetable: which subject/teacher in which class at which time.       |
| **Conflict**                | Unschedulable lesson (insufficient slots, teacher constraints, etc.).               |
| **Period**                  | A single time block (e.g., "Period 1: 08:00–08:50").                                |
| **Day Structure**           | Global template: array of CLASS/BREAK/LUNCH periods.                                |
| **Single-Resource Subject** | Subject (e.g., ICT Lab) where only 1 class can be scheduled per period globally.    |
| **Fatigue Guard**           | Constraint: Max consecutive periods without a break (default 4).                    |
| **Joint Class**             | Multi-class subject (e.g., Grade 12A + 12B share one Math class).                   |
| **Elective Block**          | Group of optional subjects where student picks one (future feature).                |
| **Profile**                 | Saved state: school + config + curriculum + schedule.                               |

---

## 11. QUICK REFERENCE: FILE MODIFICATION CHECKLIST

### Adding a New School Setting

1. [ ] Update `Settings` interface in `src/services/scheduler/index.ts`
2. [ ] Add field to `DEFAULT_DATA.settings` in `src/utils/constants.ts`
3. [ ] Add input field in `src/features/configuration/GlobalConfigView.tsx`
4. [ ] Update `src/features/configuration/hooks/useGlobalConfig.ts` hook if logic needed

### Adding a Teacher Constraint Type

1. [ ] Update `Teacher` interface in `src/services/scheduler/index.ts`
2. [ ] Add constraint logic in `src/services/scheduler/solver.ts`
3. [ ] Add UI in `src/features/teachers/TeacherEditorModal.tsx`
4. [ ] Test with `generateSchedule()`

### Adding an Export Format

1. [ ] Create new function in `src/utils/excelExport.ts` or new file
2. [ ] Add button in `src/features/generator/GeneratorView.tsx`
3. [ ] Wire handler: `onClick={() => handleExport()}`

---

## 12. FINAL REMINDERS

### ✅ DO:

- Ask for missing code
- Output complete files
- Use strict TypeScript
- Follow Tailwind conventions
- Test before submitting

### ❌ DON'T:

- Guess file contents
- Use `// ...` pseudo-code
- Install packages lightly
- Break type safety
- Mutate state directly

---

**Document Version:** 2.0 (Post-CDN-Migration)  
**Last Updated:** December 26, 2025  
**Maintained By:** Lead Developer  
**For:** EduScheduler Pro Development Team
