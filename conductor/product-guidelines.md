# Product Guidelines

## Visual Identity
- **Clean Minimalism:** Prioritize high data density and clarity. Complex scheduling grids must be legible at a glance, using whitespace and subtle borders to separate elements without creating visual noise.
- **Modern Aesthetic:** Use a professional color palette with softer accents and gently rounded corners (4px-8px) to provide a modern, approachable feel while maintaining a tool-like precision.
- **Data-First Hierarchy:** Ensure that schedule data remains the primary focus. Controls and menus should be secondary in visual weight, appearing when needed but receding during focused scheduling tasks.

## Tone of Voice
- **Professional and Authoritative:** Communication must be clear, concise, and technically precise.
- **Reliability-Focused:** Error messages and status updates should emphasize accuracy (e.g., "Conflict detected at 09:00" rather than "Oops, there's a problem").
- **Precision in Language:** Use industry-standard terminology for scheduling (e.g., "Invigilation," "Roster," "Double-booking") consistently across the application.

## Interaction Principles
- **Direct Manipulation:** Users should interact directly with the schedule. If an object is visible, it should be draggable or right-clickable for actions.
- **Interactive Precision:** Drag-and-drop operations should feel "snappy" and provide clear visual cues for valid and invalid drop targets.
- **Predictable Behavior:** Every user action must have a predictable and immediate outcome. Avoid hidden states or unexpected side effects.

## Workspace & Persistence
- **Stateful Environment:** The application must remember the user's workspace configuration, including open panels, column widths, and view filters, ensuring they can resume work exactly where they left off.
- **Context-Aware Assistance:** Provide specific, localized feedback based on the user's current task (e.g., highlighting specific room conflicts only when moving a class to that room).
