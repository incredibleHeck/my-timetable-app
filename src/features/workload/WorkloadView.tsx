import React, { useState, useMemo } from "react";
import { AppData } from "../../types";
import { Upload, Search } from "lucide-react";
import { Button, controlClass, quietButtonClass } from "../../components/ui";
import { useWorkloadStats } from "./hooks/useWorkloadStats";
import { useAnalytics } from "./hooks/useAnalytics";
import { WorkloadTeacherDetail } from "./components/WorkloadTeacherDetail";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { exportWorkloadToExcel } from "../../services/export/workload";
import { notify } from "../../components/ui/Toast";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type SortBy = "load" | "name" | "periods";
type WorkloadTab = "CAPACITY" | "ANALYTICS";

const TABS: { id: WorkloadTab; label: string }[] = [
  { id: "CAPACITY", label: "Capacity" },
  { id: "ANALYTICS", label: "Analytics" },
];

const SORTS: { id: SortBy; label: string }[] = [
  { id: "load", label: "Load" },
  { id: "name", label: "Name" },
  { id: "periods", label: "Periods" },
];

export const WorkloadView: React.FC<ViewProps> = ({ data }) => {
  const { workloadStats } = useWorkloadStats(data);
  const analytics = useAnalytics(data);
  const maxWeeklyDefault = data.settings.maxTeachingPeriodsPerWeek ?? 24;

  const [tab, setTab] = useState<WorkloadTab>("CAPACITY");
  const [nameFilter, setNameFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("load");
  const [overloadedOnly, setOverloadedOnly] = useState(false);

  const filteredStats = useMemo(() => {
    let result = [...workloadStats];

    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase();
      result = result.filter((s) => s.t.name.toLowerCase().includes(q));
    }

    if (overloadedOnly) {
      result = result.filter((s) => s.utilizationPct > 100);
    }

    if (sortBy === "name") {
      result.sort((a, b) => a.t.name.localeCompare(b.t.name));
    } else if (sortBy === "load") {
      result.sort((a, b) => b.utilizationPct - a.utilizationPct);
    } else {
      result.sort((a, b) => b.assignedPeriods - a.assignedPeriods);
    }

    return result;
  }, [workloadStats, nameFilter, sortBy, overloadedOnly]);

  const overloadedCount = workloadStats.filter((s) => s.utilizationPct > 100).length;
  const unassignedCount = workloadStats.filter((s) => s.assignedPeriods === 0).length;
  const isFiltered = Boolean(nameFilter.trim()) || overloadedOnly;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 pb-16 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content">Workload Analysis</h2>
          <p className="mt-1 text-xs text-content-muted">
            <span className="tabular-nums">{workloadStats.length}</span> teachers measured against{" "}
            <span className="tabular-nums">{maxWeeklyDefault}</span> periods per week
            {overloadedCount > 0 && (
              <>
                {" · "}
                <span className="tabular-nums text-danger-ink">{overloadedCount}</span> over
                capacity
              </>
            )}
            {unassignedCount > 0 && (
              <>
                {" · "}
                <span className="tabular-nums text-accent-ink">{unassignedCount}</span> with no
                lessons
              </>
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => exportWorkloadToExcel(workloadStats, notify)}
          icon={<Upload size={15} />}
        >
          Export Report
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Workload views"
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-edge bg-surface p-0.5"
        >
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={`h-8 rounded px-3 text-sm transition-colors focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                : "text-content-muted hover:text-content"
                            }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "CAPACITY" && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                aria-label="Search teachers by name"
                className={`${controlClass} w-full pl-8`}
                placeholder="Search by name"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>

            <div
              role="group"
              aria-label="Sort teachers by"
              className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
            >
              {SORTS.map((s) => {
                const isActive = sortBy === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSortBy(s.id)}
                    className={`h-8 rounded px-2.5 text-xs transition-colors focus-visible:outline-none
                                focus-visible:ring-2 focus-visible:ring-accent ${
                                  isActive
                                    ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                    : "text-content-muted hover:text-content"
                                }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={overloadedOnly}
              onClick={() => setOverloadedOnly((o) => !o)}
              className={`${quietButtonClass} ${
                overloadedOnly ? "border-accent bg-accent/15 text-content" : ""
              }`}
            >
              Over capacity
              {overloadedCount > 0 && (
                <span className="tabular-nums text-content-muted">{overloadedCount}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {tab === "ANALYTICS" ? (
        <AnalyticsDashboard analytics={analytics} />
      ) : (
        <div className="space-y-2">
          {isFiltered && (
            <p className="text-xs text-content-muted">
              Showing <span className="tabular-nums">{filteredStats.length}</span> of{" "}
              <span className="tabular-nums">{workloadStats.length}</span>
              <button
                type="button"
                onClick={() => {
                  setNameFilter("");
                  setOverloadedOnly(false);
                }}
                className="ml-2 rounded text-accent-ink underline-offset-4 hover:underline
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear filters
              </button>
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredStats.map((stat) => {
              const {
                t,
                assignedPeriods,
                scheduledPeriods,
                maxWeeklyCapacity,
                blockedSlots,
                utilizationPct,
                classBreakdown,
              } = stat;

              const isOver = utilizationPct > 100;
              const isHigh = utilizationPct > 85;
              const barTone = isOver ? "bg-danger" : isHigh ? "bg-accent" : "bg-success";
              const pctTone = isOver
                ? "text-danger-ink"
                : isHigh
                  ? "text-accent-ink"
                  : "text-content";

              return (
                <WorkloadTeacherDetail
                  key={t.id}
                  teacherName={t.name}
                  assignedPeriods={assignedPeriods}
                  maxWeeklyCapacity={maxWeeklyCapacity}
                  targetLoad={t.targetLoad}
                  scheduledPeriods={scheduledPeriods}
                  blockedSlots={blockedSlots}
                  classBreakdown={classBreakdown}
                >
                  <div
                    className={`rounded-lg border bg-surface px-4 py-3 transition-colors ${
                      isOver ? "border-l-2 border-edge border-l-danger" : "border-edge"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-content">{t.name}</span>
                      <span className={`shrink-0 text-sm tabular-nums ${pctTone}`}>
                        {Math.round(utilizationPct)}%
                      </span>
                    </div>

                    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-inset">
                      <div
                        className={`h-full ${barTone}`}
                        style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                      />
                    </div>

                    <p className="mt-2 flex flex-wrap gap-x-3 text-2xs tabular-nums text-content-muted">
                      <span>
                        <span className="text-content-secondary">{assignedPeriods}</span> requested
                      </span>
                      <span>
                        <span className="text-content-secondary">{scheduledPeriods}</span> scheduled
                      </span>
                      <span>
                        <span className="text-content-secondary">{maxWeeklyCapacity}</span> max
                      </span>
                      {blockedSlots > 0 && <span>{blockedSlots} blocked</span>}
                    </p>
                  </div>
                </WorkloadTeacherDetail>
              );
            })}
          </div>

          {filteredStats.length === 0 && (
            <div className="rounded-lg border border-dashed border-edge px-5 py-10 text-center">
              <p className="text-sm text-content">
                {workloadStats.length === 0
                  ? "No teachers yet."
                  : "No teachers match these filters."}
              </p>
              <p className="mt-1 text-xs text-content-muted">
                {workloadStats.length === 0
                  ? "Add staff in Teachers to see their weekly load."
                  : "Try a different name, or clear the over-capacity filter."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
