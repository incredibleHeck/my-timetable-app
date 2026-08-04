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
export const SOLVER_TIME_LIMIT_MS = 65000; // 65 seconds (5s buffer for audit/post)

/** Target solve time (ms) — solver keeps spawning runs until this elapses */
export const SOLVER_TARGET_MS = 60000;

/** Maximum iterations in the repair phase before stopping */
export const MAX_REPAIR_STEPS = 5000;

/** @deprecated Tournament sampling removed; kept for compatibility */
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
/** Default tabu tenure (iterations a move stays forbidden) */
export const TABU_TENURE_DEFAULT = 25;

/** Minimum tabu tenure after successful repair moves */
export const TABU_TENURE_MIN = 10;

/** Maximum tabu tenure when repair stagnates */
export const TABU_TENURE_MAX = 40;

/** @deprecated Use TABU_TENURE_DEFAULT */
export const TABU_LIST_SIZE = TABU_TENURE_DEFAULT;

/** Cleanup frequency for tabu list (remove expired entries) */
export const TABU_CLEANUP_FREQUENCY = 50;

/** Number of independent solver attempts within the time budget */
export const SOLVER_RUN_COUNT = 3;

/** Repair iterations without net improvement before diversification */
export const REPAIR_STAGNATION_LIMIT = 200;

/** Failed repair attempts per gang before abandoning it */
export const MAX_GANG_REPAIR_ATTEMPTS = 15;

/** Low-priority placed gangs removed during diversification */
export const REPAIR_DIVERSIFY_REMOVES = 2;

/** Max occupied slots to evaluate for swap moves per repair step */
export const MAX_SWAP_ATTEMPTS = 20;

/** Small penalty so pure empty-slot placements beat equivalent swaps */
export const REPAIR_SWAP_PENALTY = 500;

/** Max recursion depth when re-homing evicted gangs in one repair step */
export const MAX_CHAIN_DEPTH = 3;

/** Per-relocation penalty so shallow chains are preferred */
export const REPAIR_CHAIN_PENALTY = 300;

/** How many recent placements to undo when construction backtracks */
export const MAX_BACKTRACK_DEPTH = 3;

/** Total construction backtrack attempts allowed per solve run */
export const MAX_BACKTRACK_ATTEMPTS = 50;

// --- HEURISTICS ---
/**
 * MRV (Minimum Remaining Values) Configuration
 * Controls how aggressively we sort units by constraint tightness
 */
/** Process critical units before others (used in construction queue split) */
export const MRV_CRITICAL_FIRST = true;

/** Full MRV scan when queue size is below this threshold */
export const MRV_SAMPLE_THRESHOLD = 20;

// --- SCORING WEIGHTS (construction soft objectives) ---
/**
 * Weights the construction scorer actually consults.
 *
 * TEACHER_CONTINUITY, LUNCH_PROTECTION, TEACHER_WINDOW and ROOM_CHANGE used to
 * sit here too, and nothing read any of them — TEACHER_CONTINUITY appeared only
 * inside a comment in an empty `if`. They were not merely clutter: calibration
 * perturbs every key in this object across runs, so a third of each solve's
 * self-tuning was spent randomising numbers that could not affect the outcome.
 * Quality is handled after the fact by logic/objective.ts and logic/optimise.ts.
 */
export const SCORING_WEIGHTS = {
  TEACHER_GAP: -50,
  CLASS_GAP: -400,
  TEACHER_CONSECUTIVE: -500,
  SUBJECT_DISTRIBUTION: -30,
  ROOM_EFFICIENCY: 10,
  MORNING_BIAS: 0.1,
  HCD_PRIME_BIAS: 500,
  SCARCITY_PENALTY: -500,
  VARIETY_PENALTY: -150,
  FRIDAY_AFTERNOON: -30,
  WEEKLY_UNBALANCE: -100,
  SUBJECT_ADJACENCY_REWARD: 5000,
  SUBJECT_SPLIT_PENALTY: -10000,
  TEACHER_LOAD_EXPONENT: -1000,
  TEACHER_WEEKLY_VARIANCE: -150,
} as const;

export type ScoringWeightKey = keyof typeof SCORING_WEIGHTS;
export type ScoringWeightOverrides = Partial<Record<ScoringWeightKey, number>>;

/** Room penalty weights used in repair cost model */
export const ROOM_PENALTY_DISPLACEMENT = 1000;
export const ROOM_PENALTY_WANDERING = 500;
export const REPAIR_NO_ROOM_COST = 5000;
export const REPAIR_CONTINUITY_COST = 5000;
export const EVICTION_COST_PART_TIMER = 18000;
export const EVICTION_COST_SPECIALIST_DOUBLE = 15000;
export const EVICTION_COST_SPECIALIST_SINGLE = 12000;

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

/**
 * Fraction of the time budget reserved for post-feasibility optimisation.
 *
 * Only claimed once a feasible schedule exists — while lessons are unplaced,
 * finding a home for them beats polishing what is already placed.
 */
export const OPTIMISE_BUDGET_SHARE = 0.35;

/**
 * Attempts the solve window is divided into, when that is more than the caller
 * asked for.
 *
 * A repair run either converges within a handful of steps or cycles until the
 * clock stops it, so the useful currency is number of attempts rather than time
 * per attempt. Slicing more finely buys more rolls of the dice.
 */
export const MIN_SOLVER_ATTEMPTS = 8;
