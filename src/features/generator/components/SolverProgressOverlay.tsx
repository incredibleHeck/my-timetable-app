import React, { useMemo } from "react";
import { CheckCircle2, Layers, Wrench, type LucideIcon } from "lucide-react";
import { SOLVER_TARGET_MS } from "../scheduler/constants";

export type SolverLiveProgress = {
  phase: string;
  iteration: number;
  total: number;
  conflicts: number;
  runIndex: number;
  bestUnplaced: number;
  perfectRuns: number;
  elapsedMs: number;
  timeBudgetMs: number;
};

type Props = {
  progress: SolverLiveProgress | null;
  elapsedMs: number;
};

function formatSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PhaseMeta {
  label: string;
  detail: string;
  icon: LucideIcon;
  /** What the progress bar is counting in this phase. */
  unit: string;
}

function phaseMeta(phase: string): PhaseMeta {
  if (phase === "RUN_COMPLETE") {
    return {
      label: "Run complete",
      detail: "Scoring this attempt, then starting the next one",
      icon: CheckCircle2,
      unit: "Lessons placed",
    };
  }
  if (phase === "REPAIR") {
    return {
      label: "Repairing",
      detail: "Swapping and nudging lessons to close gaps",
      icon: Wrench,
      unit: "Repair moves",
    };
  }
  return {
    label: "Building",
    detail: "Placing lesson blocks into open slots",
    icon: Layers,
    unit: "Lessons placed",
  };
}

/**
 * Shown over the grid while the worker runs. It reports one thing — how far
 * through its time budget the solver is and what it has managed so far — so it
 * carries no gradients, pulses or glass, all of which competed with the numbers
 * that are the point. It also renders in both themes now: the previous version
 * hardcoded a white panel and slate text, and was unreadable in dark mode.
 */
export const SolverProgressOverlay: React.FC<Props> = ({ progress, elapsedMs }) => {
  const budgetMs = progress?.timeBudgetMs ?? SOLVER_TARGET_MS;
  const timePct = Math.min(100, (elapsedMs / budgetMs) * 100);

  const phase = progress?.phase ?? "CONSTRUCTION";
  const meta = useMemo(() => phaseMeta(phase), [phase]);
  const PhaseIcon = meta.icon;

  const phasePct =
    progress && progress.total > 0 ? Math.min(100, (progress.iteration / progress.total) * 100) : 0;

  const iteration = progress?.iteration ?? 0;
  const total = progress?.total ?? 0;
  const conflicts = progress?.conflicts;
  const runIndex = progress?.runIndex ?? 1;
  const bestUnplaced = progress?.bestUnplaced;
  const perfectRuns = progress?.perfectRuns ?? 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-slate-950/40" aria-hidden />

      <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-edge bg-surface shadow-lg">
        {/* Time budget: the one bar that always applies, so it reads as the frame. */}
        <div className="h-0.5 w-full bg-surface-inset" aria-hidden>
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${timePct}%` }}
          />
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <PhaseIcon size={16} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-content">
                  {phase === "RUN_COMPLETE" && conflicts === 0
                    ? "Conflict-free timetable found"
                    : meta.label}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{meta.detail}</p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-lg font-semibold tabular-nums text-content">
                {formatSeconds(elapsedMs)}
              </div>
              <div className="text-2xs tabular-nums text-content-muted">
                of {formatSeconds(budgetMs)}
              </div>
            </div>
          </div>

          {progress && total > 0 && (
            <div>
              <div className="mb-1.5 flex justify-between text-2xs text-content-muted">
                <span>{meta.unit}</span>
                <span className="tabular-nums">
                  {iteration.toLocaleString()} / {total.toLocaleString()}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-inset">
                <div
                  className="h-full bg-success transition-[width] duration-200 ease-out"
                  style={{ width: `${phasePct}%` }}
                />
              </div>
            </div>
          )}

          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-edge bg-edge">
            <Stat
              label="Unplaced now"
              value={conflicts !== undefined ? conflicts.toLocaleString() : "—"}
              tone={conflicts === undefined || conflicts > 0 ? "default" : "good"}
            />
            <Stat
              label="Best so far"
              value={bestUnplaced !== undefined ? bestUnplaced.toLocaleString() : "—"}
              tone={bestUnplaced === 0 ? "good" : "default"}
            />
            <Stat
              label={perfectRuns > 0 ? "Clean runs" : "Attempt"}
              value={perfectRuns > 0 ? String(perfectRuns) : `#${runIndex}`}
              tone={perfectRuns > 0 ? "good" : "default"}
            />
          </dl>

          <p className="text-2xs text-content-muted">
            Exploring combinations in the background — you can stop at any time and keep the best
            result so far.
          </p>
        </div>
      </div>
    </div>
  );
};

function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "good" }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-2xs text-content-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium tabular-nums ${
          tone === "good" ? "text-success-ink" : "text-content"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
