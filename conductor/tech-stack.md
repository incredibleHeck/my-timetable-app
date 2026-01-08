# Tech Stack: EduScheduler Pro

## Core Technologies
*   **Programming Language:** TypeScript
*   **Frontend Framework:** React 18
*   **Build System:** Vite
*   **Desktop Wrapper:** Tauri v2 (with @tauri-apps/plugin-fs and @tauri-apps/plugin-dialog)

## Styling & UI
*   **CSS Framework:** Tailwind CSS
*   **Post-processing:** PostCSS
*   **Icons:** Lucide React
*   **Interactions:** @dnd-kit (Core & Utilities)

## Data & Export
*   **Reporting:** ExcelJS
*   **Persistence:** Local File System (via Tauri) and LocalStorage (Web fallback)
*   **Export:** File-Saver, React-to-Print

## Performance & Optimization
*   **Background Processing:** Web Workers (Heuristic Solver)

## Testing
*   **Test Runner:** Vitest
*   **Library:** React Testing Library, JSDOM
