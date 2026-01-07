# Workflow: Conductor Standard

## 1. Development Process
*   **Test-Driven Development (TDD):** Every feature task MUST be broken down into a "Write Tests" sub-task followed by an "Implement Feature" sub-task.
*   **Test Coverage:** Maintain a minimum of 80% code test coverage for all new features and bug fixes.
*   **Code Quality:** Adhere strictly to the project's code style guides.

## 2. Progress Tracking & Commits
*   **Atomic Commits:** Commit changes after every successfully completed task.
*   **Task Summaries:** Use Git Notes to record a brief summary of the completed task.
*   **Branching:** Work on feature branches and merge into the main branch only after all tests pass and a final verification is completed.

## 3. Phase Completion Verification
For each phase in a track's plan, a final meta-task MUST be included:
`- [ ] Task: Conductor - User Manual Verification '<Phase Name>'`

### 3.1 Verification Protocol
1.  **Run All Tests:** Ensure all unit, integration, and end-to-end tests pass.
2.  **Lint & Type Check:** Run project-specific linting and type-checking commands.
3.  **Manual UI/UX Review:** Perform a manual walkthrough of the new features to ensure they meet the product guide and guidelines.
4.  **Documentation Update:** Ensure any necessary documentation (README, etc.) is updated.
5.  **Checkpoint:** Create a Git tag or clear commit message indicating the completion of the phase.
