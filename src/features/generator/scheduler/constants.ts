/**
 * SCHEDULER CONSTANTS
 * Centralized configuration for the timetable scheduling engine.
 *
 * ARCHITECTURE:
 * These constants control the behavior of the constraint satisfaction solver.
 * Changes here ripple through the entire scheduling pipeline, so modifications
 * should be tested thoroughly with existing test cases.
 */

// --- PERFORMANCE & TIMING ---
/** Maximum time (ms) web worker is allowed to run before timeout */
export const SOLVER_TIME_LIMIT_MS = 28000; // 28 seconds (browser safety margin)

/** Maximum iterations in the repair phase before stopping */
export const MAX_REPAIR_STEPS = 1000;

/** Sample size for heuristic search (when full scan is too expensive) */
export const HEURISTIC_SAMPLE_SIZE = 15;

// --- PRIORITY TIERS ---
/**
 * HIGH PRIORITY THRESHOLD
 * Units with priority >= this value are treated as critical and processed first.
 * Examples: Multi-class lessons, skeletal structures, blocked time slots
 */
export const PRIORITY_CRITICAL = 50000;

/**
 * PRIORITY SCORING
 * Used to distinguish between critical and non-critical units.
 * Higher values indicate more constrained units.
 */
export const CRITICAL_UNIT_PRIORITY_BOOST = 50000;
export const SPECIALIST_SINGLE_BOOST = 20000;

// --- HARD CONSTRAINT PENALTIES ---
/**
 * EVICTION COSTS
 * Penalties applied when displacing existing assignments.
 * Higher values protect complex structures from being moved.
 */
export const EVICTION_COST_SKELETON = 20000; // Multi-class / joint lessons
export const EVICTION_COST_NORMAL = 10000; // Regular lessons

/**
 * CONFLICT PENALTIES
 * Points assigned to violations during constraint checking.
 * Used to rank and sort violations by severity.
 */
export const CONFLICT_PENALTY_HARD_VIOLATION = 100000; // Teacher/room overlap
export const CONFLICT_PENALTY_BLOCK_ERROR = 20000; // Time block conflict
export const CONFLICT_PENALTY_SUBJECT_CONSTRAINT = 10000; // Subject restriction

// --- SOFT CONSTRAINT PENALTIES ---
/**
 * PEDAGOGICAL PENALTIES
 * Applied to soft constraint violations (gap filling, subject variety, etc.)
 */
export const PENALTY_SANDWICH_SPLIT = 10000; // Subject split across non-adjacent slots (XYX pattern)
export const PENALTY_TABU_MOVE = 10000; // Penaliz recent moves (tabu search)
export const PENALTY_SUBJECT_REPETITION = 5000; // Multiple occurrences same period

// --- SEARCH STRATEGY ---
/** Size of tabu list (number of recent moves to remember) */
export const TABU_LIST_SIZE = 10;

/** Cleanup frequency for tabu list (remove entries after N iterations) */
export const TABU_CLEANUP_FREQUENCY = 50;

// --- HEURISTICS ---
/**
 * MRV (Minimum Remaining Values) Configuration
 * Controls how aggressively we sort units by constraint tightness
 */
export const MRV_CRITICAL_FIRST = true; // Process critical units before others
export const MRV_SAMPLE_THRESHOLD = 20; // Use sampling if > N units to evaluate

/**
 * CONSTRAINT CHECKING MODES
 * Determines strictness of validation
 */
export const ENFORCE_IMMUTABLE_CONSTRAINTS = true; // Prevent overriding hard constraints
export const CHECK_SUBJECT_CONTINUITY = true; // Prevent 3+ same subject in a row

// --- EXPORT & DEBUGGING ---
/** Enable detailed logging in solver phases */
export const DEBUG_SOLVER_LOGGING = false;

/** Report frequency for solver progress (report every N iterations) */
export const PROGRESS_REPORT_FREQUENCY = 10;
