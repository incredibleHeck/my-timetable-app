# Track: Respect Class-Specific Structure and Curriculum in Generator

Classes were being scheduled on break and lunch times because the generator's solver and heuristics were primarily using the global day structure instead of class-specific overrides. Additionally, curriculum limits were not strictly enforced during validation.

## Phase 1: Implementation
- [x] Task: Create reproduction test case `tests/class-structure-fixed-slots.test.ts`. [6f96abe]
- [x] Task: Update `src/features/generator/scheduler/search.ts` to respect class-specific structures in `findValidMoves` and `findMinConflictMove`. [0c99841]
- [x] Task: Update `src/features/generator/scheduler/heuristics.ts` to respect class-specific structures in `countValidSlots`. [635f735]
- [x] Task: Update `src/features/generator/scheduler/validation/load-checks.ts` to enforce total curriculum subject limits. [b11ddc9]
- [ ] Task: Verify fix with reproduction test and existing test suite.