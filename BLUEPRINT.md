# EduScheduler Pro — System Blueprint & Specifications

**Status:** Production Ready (Version 5.5)
**Target:** Robust, school-wide resource & assessment management.

---

## 1. Functional Blueprint

### 1.1. Resource Management
- **Subjects:** Manage paper counts and auto-hide "Paper 1" tags for single-paper subjects.
- **Teachers:** Manage exclusions and weekly stream rotation rules.
- **Classes:** Intelligent stream grouping (e.g., 1A & 1B) for unified scheduling.

### 1.2. Exam Management Module (Grid Layout)
- **Sequential Columns:** Grid displays **Subject 1** and **Subject 2** columns based on start-time sequence.
- **Intra-Column Split:** 50/50 vertical split for multi-paper subjects (P1 on Left, P2 on Right) within a single cell.
- **Subject Integrity:** Automated synchronization of swaps and updates across all parallel class streams.
- **Visual Polish:** Spacious cards with top-accent color bars and clean metadata stacks.

### 1.3. Automated Invigilator Allocation
- **Staff Rotation:** "One Stream Per Week" rule prevents teachers from supervising the same cohort multiple times.
- **Exclusion Workflow:** Manual staff removal modal before auto-assignment runs.
- **Workload Fairness:** Balanced random distribution based on least-busy faculty heuristics.

### 1.4. Contextual Export Engine
- **Student Copy (A4):** Multi-sheet Excel/PDF optimized for A4 portrait. Deduped shared subjects, hidden staff names, and "Xh XXm" duration formatting.
- **Staff Roster (A3):** Master grid of Class vs. Date. Optimized for A3 landscape with vertical teacher name stacking.

---

## 2. Roadmap

### 2.1. Phase 4: Interaction & Polish (Completed)
- [x] **Smart Stacking:** Vertical stacking of teacher names in roster views.
- [x] **Staff Rotation Rules:** Weekly stream limitation logic.
- [x] **Resource Anchoring:** Decoupling subjects from staff during swaps.
- [x] **Professional Headers:** Official school branding on all exports.

### 2.2. Phase 5: Future Enterprise (Planned)
- [ ] **Multi-Week Cycles:** Support for A/B week rotation.
- [ ] **Native Undo/Redo:** Versioning stack in local state.
- [ ] **Cloud Sync:** Optional backend integration for cross-device access.

---

## 3. Engineering Standards

### State Commitment Rules
1.  **Paired Matching:** Swaps must preserve individual resource contexts for parallel streams.
2.  **Immutability:** State updates use deep-copied snapshots via `onUpdate`.
3.  **Security:** Student-facing exports must never leak invigilator assignments.

---

**Blueprint Version:** 5.5  
**Ref:** `ARCHITECTURE.md` for technical implementation details.