import React, { useMemo } from "react";
import {
  Layers,
  Wrench,
  Sparkles,
  Target,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
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

function phaseMeta(phase: string) {
  if (phase === "RUN_COMPLETE") {
    return {
      label: "Run complete",
      headline: "Scoring this attempt",
      detail: "Starting the next combination search",
      icon: CheckCircle2,
      accent: "from-emerald-400 to-teal-500",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      ring: "ring-emerald-500/20",
    };
  }
  if (phase === "REPAIR") {
    return {
      label: "Repair phase",
      headline: "Polishing the timetable",
      detail: "Swapping and nudging lessons to close gaps",
      icon: Wrench,
      accent: "from-violet-500 to-indigo-600",
      badge: "bg-violet-100 text-violet-700 border-violet-200",
      ring: "ring-violet-500/20",
    };
  }
  return {
    label: "Construction",
    headline: "Building your schedule",
    detail: "Placing lesson blocks into open slots",
    icon: Layers,
    accent: "from-amber-400 to-orange-500",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    ring: "ring-amber-500/20",
  };
}

export const SolverProgressOverlay: React.FC<Props> = ({
  progress,
  elapsedMs,
}) => {
  const budgetMs = progress?.timeBudgetMs ?? SOLVER_TARGET_MS;
  const timePct = Math.min(100, (elapsedMs / budgetMs) * 100);

  const phase = progress?.phase ?? "CONSTRUCTION";
  const meta = useMemo(() => phaseMeta(phase), [phase]);
  const PhaseIcon = meta.icon;

  const phasePct =
    progress && progress.total > 0
      ? Math.min(100, (progress.iteration / progress.total) * 100)
      : 0;

  const iteration = progress?.iteration ?? 0;
  const total = progress?.total ?? 0;
  const conflicts = progress?.conflicts;
  const runIndex = progress?.runIndex ?? 1;
  const bestUnplaced = progress?.bestUnplaced;
  const perfectRuns = progress?.perfectRuns ?? 0;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <div
        className={`absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] ${meta.ring} ring-1 ring-inset`}
        aria-hidden
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`}
          style={{ width: `${timePct}%` }}
        />

        <div className="p-6 pb-5">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent} text-white shadow-lg shadow-amber-500/20`}
              >
                <PhaseIcon size={20} className="drop-shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  <Sparkles size={12} className="text-amber-500 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight">
                  {phase === "RUN_COMPLETE" && conflicts === 0
                    ? "Perfect timetable found!"
                    : phase === "RUN_COMPLETE"
                      ? "Run finished"
                      : meta.headline}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{meta.detail}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-mono font-bold tabular-nums text-slate-800">
                {formatSeconds(elapsedMs)}
              </div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                of {formatSeconds(budgetMs)}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Time budget</span>
              <span>{Math.round(timePct)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${meta.accent} transition-[width] duration-300 ease-out relative overflow-hidden`}
                style={{ width: `${timePct}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>

          {progress && total > 0 && (
            <div className="mb-5">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>
                  {phase === "REPAIR" ? "Repair moves" : "Lessons placed"}
                </span>
                <span>
                  {iteration.toLocaleString()} / {total.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400/70 transition-[width] duration-200 ease-out"
                  style={{ width: `${phasePct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  perfectRuns > 0
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70">
                  Perfect timetables
                </div>
                <div className="text-xs text-slate-500">
                  Runs with zero audit conflicts
                </div>
              </div>
            </div>
            <div
              className={`text-3xl font-bold tabular-nums leading-none ${
                perfectRuns > 0 ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {perfectRuns}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile
              icon={<AlertCircle size={14} />}
              label="Unplaced now"
              value={
                conflicts !== undefined ? conflicts.toLocaleString() : "—"
              }
              tone={
                conflicts === undefined
                  ? "slate"
                  : conflicts > 0
                    ? "amber"
                    : "emerald"
              }
            />
            <StatTile
              icon={<Target size={14} />}
              label="Best unplaced"
              value={
                bestUnplaced !== undefined ? bestUnplaced.toLocaleString() : "—"
              }
              tone={
                bestUnplaced === undefined
                  ? "slate"
                  : bestUnplaced === 0
                    ? "emerald"
                    : "amber"
              }
            />
            <StatTile
              icon={<RotateCcw size={14} />}
              label="Run attempt"
              value={`#${runIndex}`}
              tone="slate"
            />
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <p className="text-[11px] text-slate-500 font-medium">
            Exploring combinations in the background — you can stop anytime
          </p>
        </div>
      </div>
    </div>
  );
};

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "slate";
}) {
  const tones = {
    amber: "text-amber-700 bg-amber-50 border-amber-100",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
    slate: "text-slate-700 bg-slate-50 border-slate-100",
  };

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${tones[tone]} transition-colors duration-300`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums leading-none">{value}</div>
    </div>
  );
}
