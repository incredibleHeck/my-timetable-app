# Specification: Fix Cross-Subject Swap Validation

## Overview
Swapping periods of different subjects taught by the same teacher (e.g., Math -> English) fails validation with a "Max 2 periods" error, even when the swap preserves the total count for both subjects. This indicates that the validation logic double-counts the subject at the target slot or fails to ignore the source slot correctly in this specific context.

## Root Cause
Likely a nuance in how `checkSlotValidity` ignores slots when the subject being validated is different from the subject currently occupying the target slot (which is the case in a cross-subject swap).

## Solution
Ensure that `checkSlotValidity` correctly identifies and ignores the slot being displaced (the target slot) even if it contains a *different* subject, effectively treating it as empty for the purpose of the move.

## Affected Areas
- `src/services/scheduler/validation.ts`

## Verification
- Reproduction test case: 2 Eng, 2 Math. Swap 1 Eng with 1 Math.
