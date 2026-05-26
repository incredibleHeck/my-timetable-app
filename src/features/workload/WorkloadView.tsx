import React from "react";
import { AppData } from "../../types";
import { Card, Button } from "../../components/ui";
import { Upload, AlertCircle, Clock } from "lucide-react";
import { useWorkloadStats } from "./hooks/useWorkloadStats";
import { WorkloadTeacherDetail } from "./components/WorkloadTeacherDetail";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const WorkloadView: React.FC<ViewProps> = ({ data }) => {
  const { workloadStats } = useWorkloadStats(data);
  const maxWeeklyDefault = data.settings.maxTeachingPeriodsPerWeek ?? 24;

  const handleExportCSV = () => {
    const headers = [
      "Teacher Name",
      "Requested Periods",
      "Scheduled Periods",
      "Blocked Slots",
      "Max Weekly Periods",
      "Utilization %",
    ];
    const rows = workloadStats.map((s) => [
      s.t.name,
      s.assignedPeriods,
      s.scheduledPeriods,
      s.blockedSlots,
      s.maxWeeklyCapacity,
      `${s.utilizationPct.toFixed(1)}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "faculty_workload_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Capacity Planning
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Utilization is based on requested curriculum load vs the school-wide
            max of {maxWeeklyDefault} periods per week. Hover or click a card
            for class breakdown.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-200 pr-4 mr-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>{" "}
              Optimal
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div> High
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div> Overload
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            icon={<Upload size={16} />}
          >
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workloadStats.map((stat) => {
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
                  utilizationPct > 100
                    ? "ring-2 ring-red-500 ring-offset-2"
                    : ""
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
                      <span className="font-bold text-slate-800 block leading-tight">
                        {t.name}
                      </span>
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
        {workloadStats.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            No teachers found. Add faculty to see analysis.
          </div>
        )}
      </div>
    </div>
  );
};
