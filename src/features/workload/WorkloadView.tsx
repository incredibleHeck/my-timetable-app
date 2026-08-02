import React, { useState, useMemo } from "react";
import { AppData } from "../../types";
import { Card, Button } from "../../components/ui";
import { Upload, AlertCircle, Clock, Search, ArrowUpDown, AlertTriangle } from "lucide-react";
import { useWorkloadStats } from "./hooks/useWorkloadStats";
import { WorkloadTeacherDetail } from "./components/WorkloadTeacherDetail";
import { exportWorkloadToExcel } from "../../services/export/workload";
import { notify } from "../../components/ui/Toast";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type SortBy = "name" | "load" | "periods";

export const WorkloadView: React.FC<ViewProps> = ({ data }) => {
  const { workloadStats } = useWorkloadStats(data);
  const maxWeeklyDefault = data.settings.maxTeachingPeriodsPerWeek ?? 24;

  const [nameFilter, setNameFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("load");
  const [overloadedOnly, setOverloadedOnly] = useState(false);

  const handleExportExcel = () => {
    exportWorkloadToExcel(workloadStats, notify);
  };

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
    } else if (sortBy === "periods") {
      result.sort((a, b) => b.assignedPeriods - a.assignedPeriods);
    }

    return result;
  }, [workloadStats, nameFilter, sortBy, overloadedOnly]);

  const overloadedCount = workloadStats.filter((s) => s.utilizationPct > 100).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Capacity Planning</h2>
          <p className="text-xs text-slate-500 mt-1">
            Utilization is based on requested curriculum load vs the school-wide max of{" "}
            {maxWeeklyDefault} periods per week. Hover or click a card for class breakdown.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-200 pr-4 mr-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Optimal
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div> High
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div> Overload
            </div>
          </div>
          <Button variant="secondary" onClick={handleExportExcel} icon={<Upload size={16} />}>
            Export Report
          </Button>
        </div>
      </div>

      {/* Filter / Sort Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by teacher name..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-amber-400 text-slate-700 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <ArrowUpDown size={12} className="text-slate-400 ml-1.5" />
          {(["load", "name", "periods"] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${
                sortBy === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s === "load" ? "Load %" : s === "periods" ? "Periods" : "Name"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOverloadedOnly((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
            overloadedOnly
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-white border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
          }`}
        >
          <AlertTriangle size={12} />
          Overloaded Only
          {overloadedCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {overloadedCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          let statusColor = "bg-emerald-500";

          if (utilizationPct > 100) {
            statusColor = "bg-red-600";
          } else if (utilizationPct > 85) {
            statusColor = "bg-amber-500";
          }

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
              <Card
                className={`p-5 flex flex-col gap-3 transition-all hover:shadow-md ${
                  utilizationPct > 100 ? "ring-2 ring-red-500 ring-offset-2" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-600 border ${
                        utilizationPct > 100
                          ? "bg-red-100 border-red-300 text-red-700"
                          : "bg-slate-100 border-slate-200"
                      }`}
                    >
                      {t.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">{t.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        {blockedSlots > 0 ? (
                          <>
                            <Clock size={10} /> {blockedSlots} periods blocked
                          </>
                        ) : (
                          "Full availability"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xl font-bold ${
                        utilizationPct > 100
                          ? "text-red-600"
                          : utilizationPct > 85
                          ? "text-amber-600"
                          : "text-slate-700"
                      }`}
                    >
                      {Math.round(utilizationPct)}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">
                      Load
                    </span>
                  </div>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-100">
                  <div
                    className={`h-full ${statusColor} transition-all duration-1000`}
                    style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                  />
                  {utilizationPct > 100 && (
                    <div
                      className="h-full bg-red-700 animate-pulse striped-bar"
                      style={{
                        width: `${Math.min(utilizationPct - 100, 100)}%`,
                      }}
                    />
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-50 mt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500">
                      <strong>{assignedPeriods}</strong> Requested
                    </span>
                    <span className="text-slate-400">
                      <strong>{scheduledPeriods}</strong> Scheduled
                    </span>
                  </div>
                  <div className="text-slate-400 text-right">
                    <strong>{maxWeeklyCapacity}</strong> Weekly max
                  </div>
                </div>

                {utilizationPct > 100 && (
                  <div className="flex items-center gap-2 text-[10px] text-red-600 font-bold bg-white/50 px-2 py-1 rounded">
                    <AlertCircle size={12} /> Teacher is overloaded!
                  </div>
                )}
              </Card>
            </WorkloadTeacherDetail>
          );
        })}
        {filteredStats.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            {workloadStats.length === 0
              ? "No teachers found. Add faculty to see analysis."
              : "No teachers match your current filters."}
          </div>
        )}
      </div>
    </div>
  );
};
