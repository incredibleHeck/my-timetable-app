# Specification: Fix Cross-Subject Double Period Swap Validation

## Overview
Swapping DOUBLE periods of different subjects (e.g., Math P0-P1 -> Science P2-P3) still triggers "Max 2 periods" or similar errors, despite previous fixes for single periods.

## Root Cause
Potential double-counting or index mismatch when ignoring the target slots for multi-period blocks.

## Solution
Ensure the ignore logic covers all indices occupied by the target subject at the target position.

## Verification
- Reproduction test with Double Math and Double Science.
