# EduScheduler Pro — Architecture & Engineering Guide

**Version:** 10.0 (Worker-Enabled Multi-Tenant Edition)
**Last Updated:** January 5, 2026
**Framework:** React 18 + Vite + TypeScript

---

## 1. Executive Summary

**EduScheduler Pro** is a high-performance, client-side resource scheduling suite. It manages class timetables, examination periods, and supervision rosters using specialized heuristic engines.

The architecture emphasizes:
1.  **Multi-Tenancy (Profiles):** Profile-based state management allowing users to maintain multiple academic terms or draft scenarios in a single session.
2.  **Background Optimization:** High-complexity class scheduling is offloaded to Web Workers, enabling iterative solving without UI blocking.
3.  **Local-First & Desktop-Ready:** Hybrid File System API supporting both browser-based downloads and native OS dialogs via Tauri.
4.  **Resource Bottleneck Heuristics:** Prioritizing "Restricted Resources" (staff with low availability or joint classes) to ensure jar-filling efficiency.

---

## 2. Directory Structure

```text
src/
├── App.tsx                     # 👑 Root: Profile orchestration, View routing, & Auto-save.
├── types/                      # Single source of truth for domain interfaces (AppData, Slot).
├── features/                   # Feature-Encapsulated Domains
│   ├── generator/              # ⚡ Timetable Solver: Worker integration & Swap/Move tools.
│   ├── exams/                  # 📝 Exam Coordination: Uniform vs Random strategies.
│   ├── duty/                   # 🛡️ Supervision: Daily/Weekly rotation rosters.
│   ├── workload/               # 📊 Capacity Analysis: Real availability vs Assigned load.
│   ├── teachers/               # 👥 Faculty: Availability matrices & specialty linking.
│   └── classes/                # 🏫 Curriculum: Joint classes & Vertical elective blocks.
├── services/                   # Cross-cutting concerns.
│   ├── scheduler/              # 🧠 Core Solver: Heuristics, Validation, & Preparation.
│   ├── export/                 # 📄 Pro Document Engine: Context-aware Excel/PDF output.
│   └── fileSystem/             # 💾 Persistence: Sanitization & Platform-specific IO.
└── components/ui/              # Atomic Design System (Modals, Buttons, Inputs).
```

---

## 3. Core Data Architecture

### 3.1. Profile State Wrapper
The application wraps `AppData` in a `Profile` object. This allows for switching contexts (e.g., from "Semester 1" to "Summer School") without data collision. All updates are deep-cloned and debounced to `localStorage`.

### 3.2. Scheduling Entities
- **JointClass:** Links multiple classes to a single teacher/subject slot (Horizontal sync).
- **ElectiveBlock:** Links multiple subjects to a single class slot (Vertical gang scheduling).
- **ScheduleSlot:** The atomic unit of the timetable, supporting "locked" states and elective identification.

---

## 4. Specialized Scheduling Engines

### 4.1. The Timetable Solver (v10)
- **Preparation:** Curriculums are decomposed into `AllocationUnits` (Singles/Doubles).
- **Heuristics:** Units are scored based on teacher bottleneck severity (+50 per blocked slot) and joint class complexity (+10,000).
- **Iteration:** The Web Worker runs a 3-second optimization loop, generating hundreds of candidates and committing only the version with the minimum conflict count.

### 4.2. Exam Generator Algorithms
- **Uniform (Cohort) Mode:** All classes in a level write simultaneously.
- **Random (Staggered) Mode:** Maximizes slot density by staggering papers, with optional "Stream Sync" to keep parallel classes (e.g., 10A/10B) aligned.
- **Invigilator Allocator:** Respects a "One Stream Per Week" rule to ensure staff rotate across different student cohorts fairly.

### 4.3. Duty Rotation Engine
- Supports **Daily** (5-day) and **Weekly** (Multi-week) rotations.
- Uses a "Cycle-Fair" algorithm that resets staff availability only when the entire eligible pool has been exhausted.

---

## 5. Interaction & Presentation

### 5.1. The Smart Grid
- **Dynamic Structure:** Grids automatically adjust to class-specific overrides (e.g., Year 7 having extra periods or different break times).
- **Interaction Tools:** Supports both a "Selection-based" Move/Swap tool and native Drag-and-Drop.
- **Conflict Feedback:** Real-time validation checks for teacher availability, room capacity, and daily subject limits.

---

## 6. Export Systems

### 6.1. Professional Document Generator
- **A4/A3 Optimization:** Automatically switches between Portrait A4 (Student Timetables) and Landscape A3 (Master Staff Rosters).
- **Data Security:** Strict masking of invigilator names on student-facing exports.
- **Formatting:** Converts minutes to "Xh XXm" strings and applies contrast-aware color coding.