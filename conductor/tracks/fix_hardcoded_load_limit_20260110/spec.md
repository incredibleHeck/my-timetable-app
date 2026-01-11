# Specification: Relax Hardcoded Daily Load Limit

## Overview
The validation logic currently enforces a hardcoded daily limit of 6 periods per teacher. This prevents users with schedules containing 7 or 8 periods (common in many schools) from moving or swapping lessons, as any change triggers the "Limit Exceeded" error.

## Root Cause
In `src/services/scheduler/validation.ts`, `maxDailyLoad` is hardcoded to `6`.

## Solution
Update `maxDailyLoad` to use `settings.periodsPerDay`. This ensures the limit scales with the configured school day.

## Verification
- Verify that a teacher with 7 periods can successfully move a lesson (assuming `periodsPerDay` >= 7).
