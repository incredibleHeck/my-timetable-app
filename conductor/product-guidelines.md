# Product Guidelines: EduScheduler Pro

## Prose & Communication
*   **Tone:** Professional and Technical. Use precise institutional and scheduling terminology (e.g., "Heuristic Solver," "Joint Class," "Invigilation Roster") to provide clarity for expert users.
*   **Error Messaging:** Provide clear, technical reasons for failures (e.g., "Conflict: Room 101 over capacity for Period 3") rather than generic messages.

## Visual Identity & Aesthetic
*   **Aesthetic:** High-Utility "Studio" Look. Use a neutral gray or dark mode palette with high-contrast accent colors for critical status indicators (conflicts, successes, locked states).
*   **Platform Alignment:** While maintaining a unique "Studio" feel, ensure UI elements (buttons, inputs) feel robust and responsive on the Windows desktop environment.

## Conflict Visualization
*   **Detailed Tooltips:** Every scheduling conflict must provide a comprehensive explanation on hover, detailing the specific constraint violation.
*   **Persistent Conflict Panel:** Maintain a dedicated side panel that lists all active conflicts globally across the current profile, allowing for quick navigation and resolution.

## Profile & Navigation
*   **Context Awareness:** Use persistent sidebar switchers and visual badging/headers to clearly identify the active Profile/Term.
*   **Interactive Efficiency:** Prioritize non-modal side panels for wizards and multi-step processes, allowing users to reference the main schedule grid while performing administrative tasks.

## Desktop Interaction
*   **Density:** Maximize screen real estate for data visualization, assuming high-resolution desktop displays.
*   **Responsiveness:** Ensure all drag-and-drop interactions and grid updates feel instantaneous, leveraging the low-latency environment of a native desktop app.
