# Initial Concept
EduScheduler Pro is a desktop application built with Tauri and React designed to streamline school timetable management, including class scheduling, exam logistics, and duty assignments.

# Product Guide

## Vision
EduScheduler Pro aims to be the premier desktop solution for complex scheduling needs across educational and corporate environments. By combining a powerful automated conflict detection engine with an intuitive, interactive drag-and-drop interface, it empowers coordinators to create error-free schedules with unprecedented speed and flexibility.

## Target Users
- **School Administrators and Timetable Coordinators:** Managing complex K-12 schedules with intricate teacher, room, and student constraints.
- **University Department Heads:** Coordinating course rotations, lecture hall bookings, and academic staff availability.
- **Corporate Training Managers:** Organizing professional development sessions, instructor rotations, and facility usage.

## Primary Goals
- **Automated Conflict Resolution:** Eliminate scheduling errors by automatically detecting and highlighting overlaps in room bookings, teacher assignments, and equipment usage.
- **Streamlined Logistics:** Simplify the generation of specialized schedules, such as exam invigilation rosters and staff duty rotations, which are traditionally time-consuming to create manually.
- **Interactive Planning:** Provide a fluid "what-if" environment where users can manually refine schedules using drag-and-drop tools, backed by a global Undo/Redo system, while receiving instant feedback on validity.

## Key Features
- **Real-time Conflict Engine:** A sophisticated, time-aware engine with severity-based reporting (High, Medium, Low). It intelligently monitors overlaps across staggered class schedules and multi-class groupings (Joint/Elective), providing instant feedback on teacher availability, room capacity, and scheduling rules based on absolute time windows and unique period occupancy.
- **Visual Schedule Builder:** A high-performance, drag-and-drop grid that intelligently handles complex period structures, including double periods split by breaks or lunch, ensuring logical units move together during swaps.
- **Intelligent Dashboard:** A centralized control center with optimized spatial hierarchy, featuring integrated profile management, granular class-specific timing overrides, real-time health metrics (including teacher workload saturation and over-allocation alerts), and a prominent activity history log for streamlined session oversight.
- **Workflow-Optimized Navigation:** A logically categorized sidebar designed around the scheduling workflow (General, System, Academic Data, Scheduling, Operations), providing quick access to all critical modules.
- **Global Undo/Redo Safety Net:** A comprehensive history tracking system for all scheduling operations, allowing users to experiment with changes safely using standard shortcuts and dedicated UI controls.
- **Interactive Conflict Highlighting:** Direct integration between the conflict report and the schedule grid, allowing users to instantly locate and resolve violations with a single click.
- **Professional Export Suite:** One-click generation of professional-grade PDFs and Excel spreadsheets tailored for different stakeholders (staff, students, facilities).
