# EduScheduler Pro — System Blueprint & Specifications

**Status:** Active Development
**Target:** Robust, client-side academic scheduling system.

---

## 1. System Context Diagram

```mermaid
graph TD
    User((User))
    Browser[Web Browser / Electron Shell]
    
    subgraph "EduScheduler Pro (Client-Side)"
        App[App Orchestrator]
        Store[Local Storage / File System]
        
        subgraph "UI Layer"
            Dash[Dashboard View]
            Config[Configuration View]
            InputViews[Data Entry Views]
            GenView[Generator View]
        end
        
        subgraph "Logic Layer"
            Validator[Data Validator]
            Exporter[Excel/PDF Service]
        end
        
        subgraph "Compute Layer (Worker)"
            Solver[Heuristic Solver]
        end
    end

    User --> Browser
    Browser --> App
    App --> Store
    App --> UI Layer
    
    InputViews --> Validator
    GenView --> Solver
    GenView --> Exporter
    
    Solver --> App : Returns Schedule/Conflicts
```

---

## 2. Functional Blueprint

### 2.1. Data Management Module
**Goal:** Define the academic constraints and resources.

- **Global Config:** 
  - Defines the "Skeleton" of the day (e.g., 8 periods, Break after P2, Lunch after P5).
  - Defines the "Timeline" (Start/End times for each slot).
- **Resources:**
  - **Subjects:** Abstract definitions (Color, Name). Property `isSingleResource` ensures unique global usage (e.g., "Chemistry Lab").
  - **Teachers:** The primary constraint resource. Can be "Blocked" for specific periods (Part-time staff).
  - **Classes:** The primary output target. Each class has a unique "Curriculum" (Requirement Matrix).

### 2.2. The Generator Module (The "Solver")
**Goal:** Place $N$ curriculum items into $T \times P$ slots (Days $\times$ Periods) with zero collisions.

**Algorithm Blueprint:**
1.  **Input:** Deep clone of `AppData`.
2.  **Pre-Processing:** 
    - Flatten all Class Curriculums into a single list of `AllocationUnit`s.
    - **Score & Sort:** Assign difficulty scores.
        - `Double Period` = +10 difficulty (Needs 2 contiguous slots).
        - `Teacher Availability < 50%` = +20 difficulty.
        - `Single Resource Subject` = +15 difficulty.
    - Sort list Descending (Hardest first).
3.  **Greedy Allocation:**
    - For `Unit U` in `List`:
        - Iterate `Days D` (0..4) -> `Periods P` (0..N):
            - **Hard Constraints Check:**
                - Is `Slot(D, P)` type == "CLASS"?
                - Is `Teacher` free at `(D, P)`?
                - Is `Class` free at `(D, P)`?
                - If `SingleResource`, is it used globally at `(D, P)`?
                - If `DoublePeriod`, is `(D, P+1)` also valid?
            - **Soft Constraints (Scoring):**
                - Prefer Mornings for Core Subjects? (+Score)
                - Avoid Teacher gaps? (+Score)
                - Avoid 3 consecutive single lessons of same subject? (+Score)
        - Pick Best Slot.
        - Update State (`OccupancyGrids`).
4.  **Failure Handling:**
    - If no slot found, push to `Conflicts` array.
5.  **Output:** Return Result to Main Thread.

### 2.3. Interactive Adjustment Module
**Goal:** Allow humans to refine the AI's output.

- **Visual Interface:** `ScheduleGrid`.
- **Drag & Drop Logic:**
  - **Source:** User clicks a slot (Green Highlight).
  - **Target:** User hovers another slot.
  - **Validation:** Real-time `checkSlotValidity()` runs.
    - If Target is Empty: Check move validity.
    - If Target is Full: Check **SWAP** validity (Can Slot A go to B AND Slot B go to A?).
  - **Action:** User clicks Target.
    - State updates instantly.
    - "Lock" icon appears (Future: Prevent solver from moving this).

---

## 3. Data Schema Specifications

### 3.1. Persistence Format (`.json`)
The application saves a snapshot of the entire state. This file is the "Project File".

| Field | Type | Description |
| :--- | :--- | :--- |
| `version` | string | Schema version (implicit). |
| `settings` | Object | The global configuration. |
| `teachers` | Array | List of teacher objects + constraints. |
| `classes` | Array | List of class objects + curriculum + fixed sessions. |
| `schedule` | Map | The solved grid. **Critical:** This is sparse. Empty slots are `undefined`. |

**Sanitization Policy:**
- When loading, any missing top-level key (e.g., `electives`) MUST be injected as empty array `[]`.
- `settings.fixedOccasions` must be normalized (handle strings vs objects).

---

## 4. UI/UX Specifications

### 4.1. Dashboard
- **KPI Cards:** Total Teachers, Classes, Saturation % (How full is the schedule?).
- **Health Check:** "Red/Yellow/Green" status.
    - Red: Missing Subjects, 0 Periods defined.
    - Yellow: Unused teachers.
    - Green: Ready to generate.

### 4.2. Generator View
- **Split Screen:** Sidebar (Class List) | Main Content (Grid).
- **Grid Layout:** 
    - **X-Axis:** Periods (Header).
    - **Y-Axis:** Days (Rows).
    - **Cells:** Interactive components.
- **Visual Feedback:**
    - **Colors:** Derived from Subject color.
    - **Opacity:** Used for "Fixed/Locked" slots.
    - **Borders:** Dashed = Dragging. Solid = Placed.

### 4.3. Print Layouts
- **Technique:** CSS `@media print`.
- **Behavior:** Hides sidebar, buttons, and decorative backgrounds.
- **Format:** Forces Landscape. Scales grid to fit A4/Letter.

---

## 5. Future Roadmap & Extension Points

### 5.1. Phase 1: Complexity (Current)
- [x] Basic Conflict Resolution.
- [x] Teacher Constraints.
- [x] Double Periods.

### 5.2. Phase 2: Advanced Constraints (Planned)
- [ ] **Room Management:** Explicit Room resource allocation (beyond generic "Single Resource").
- [ ] **Elective Blocks:** Scheduling "Option Lines" where multiple classes occur simultaneously (e.g., Art/Music/Drama).
- [ ] **Teacher Workload Balancing:** Soft constraint to equalize free periods across the week.

### 5.3. Phase 3: Enterprise Features (Planned)
- [ ] **User Accounts:** Cloud sync (requires backend).
- [ ] **Publishing:** Generate a public "View Only" URL for students.
- [ ] **Versioning:** Native Undo/Redo stack in memory.

---

## 6. Implementation Guide (For Developers)

### Adding a New Constraint
1.  **Data Layer:** Add the property to `types/index.ts`.
2.  **UI Layer:** Add the toggle/input in the specific Feature View.
3.  **Solver Layer:** 
    - Go to `src/services/scheduler/solver.ts`.
    - Locate the `// Constraints Check` block inside the nested loop.
    - Add `if (myNewConstraintViolated) continue;`.
4.  **Validation Layer:** Mirror the logic in `src/utils/schedulerValidation.ts` for the UI feedback.

### Modifying the Grid
- The Grid uses CSS Grid Layout.
- **Column Definition:** `minmax(120px, 1fr)` ensures responsiveness but enforces readability.
- **Scroll Handling:** The outer container handles X-scroll. Inner container handles Y-scroll only if needed, but currently page scroll is preferred.

---

**Blueprint Version:** 1.0  
**Author:** System Architect  
**Ref:** `ARCHITECTURE.md` for technical implementation details.
