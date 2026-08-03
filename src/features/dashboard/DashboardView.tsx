import React, { useRef } from "react";
import {
  Users,
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  FolderOpen,
  Plus,
  Download,
  Upload,
  FileText,
  Shield,
} from "lucide-react";
import { AppData, ViewState } from "../../types";
import { Card, Button, Badge } from "../../components/ui";
import { useDashboard } from "./hooks/useDashboard";
import { useProfile } from "../../contexts/ProfileContext";

import { MetricCard } from "./components/MetricCard";
import { QuickAction } from "./components/QuickAction";
import { ProfileModals } from "./components/ProfileModals";
import { SystemStatus } from "./components/SystemStatus";
import { RecentActivity } from "./components/RecentActivity";
import { SetupStepper } from "./components/SetupStepper";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  profileName: string;
  onNavigate?: (view: ViewState) => void;
}

export const DashboardView: React.FC<ViewProps> = ({ data, profileName, onNavigate, onUpdate }) => {
  const { profiles, createNewProfile, switchProfile, isSaving } = useProfile();

  const {
    createModalOpen,
    setCreateModalOpen,
    loadModalOpen,
    setLoadModalOpen,
    newProfileName,
    setNewProfileName,
    metrics,
    healthIssues,
    handleExportBackup,
    handleImportBackup,
  } = useDashboard(data, onUpdate);

  const { issues, conflicts } = healthIssues;

  // --- FILE SYSTEM HANDLERS ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImportBackup(file);
      e.target.value = "";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HIDDEN FILE INPUT */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-2xl border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-900/40" />
        <div className="absolute -right-20 -top-20 h-96 w-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 h-full w-1/3 bg-gradient-to-l from-amber-500/5 to-transparent transform skew-x-12 pointer-events-none" />

        <div className="relative p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {/* App Icon */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl shadow-amber-500/20 shrink-0 ring-2 ring-amber-500/30">
                <img
                  src="/icon.png"
                  alt="EduScheduler Pro"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Badge className="bg-amber-500 text-slate-900 border-none px-3 py-1 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)] tracking-wide">
                  PRO SUITE 10.0
                </Badge>
                <span className="text-amber-500/60 text-xs font-mono font-bold uppercase tracking-widest">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                Welcome back, <span className="text-amber-500">Admin.</span>
              </h1>
              <div className="flex flex-col gap-1 text-slate-300 text-sm md:text-base font-medium">
                <p>
                  Active Profile:{" "}
                  <strong className="text-white border-b-2 border-amber-500/50 pb-0.5 ml-1">
                    {profileName}
                  </strong>
                </p>
                <div className="mt-2">
                  <SystemStatus
                    isSaving={isSaving}
                    isGenerating={false}
                    hasConflicts={conflicts > 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Header Action Buttons (Profile Management) */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto min-w-[360px]">
            <Button
              icon={<Plus size={16} />}
              onClick={() => setCreateModalOpen(true)}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 transition-all font-bold text-xs py-3"
            >
              New Profile
            </Button>
            <Button
              icon={<FolderOpen size={16} />}
              onClick={() => setLoadModalOpen(true)}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 transition-all font-bold text-xs py-3"
            >
              Switch Profile
            </Button>
            <Button
              icon={<Upload size={16} />}
              onClick={handleExportBackup}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 transition-all font-bold text-xs py-3"
            >
              Export JSON
            </Button>
            <Button
              icon={<Download size={16} />}
              onClick={handleImportClick}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 transition-all font-bold text-xs py-3"
            >
              Import JSON
            </Button>
          </div>
        </div>
      </div>

      {/* SETUP STEPPER */}
      <SetupStepper data={data} onNavigate={onNavigate ?? (() => {})} />

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Staff"
          value={metrics.teacherCount}
          icon={<Users size={20} />}
          color="blue"
          subtext={
            metrics.overloadedCount > 0
              ? `${metrics.overloadedCount} overloaded`
              : `${metrics.teacherCount} active`
          }
          onClick={() => onNavigate && onNavigate("TEACHERS")}
        />
        <MetricCard
          label="Class Groups"
          value={metrics.classCount}
          icon={<BookOpen size={20} />}
          color="emerald"
          subtext={`${metrics.classCount} classes`}
          onClick={() => onNavigate && onNavigate("CLASSES")}
        />
        <MetricCard
          label="Subjects"
          value={metrics.subjectCount}
          icon={<Layers size={20} />}
          color="violet"
          subtext="Active in curriculum"
          onClick={() => onNavigate && onNavigate("SUBJECTS")}
        />
        <MetricCard
          label="Unplaced"
          value={conflicts}
          icon={<AlertTriangle size={20} />}
          color="red"
          subtext="Conflicts found"
          onClick={() => onNavigate && onNavigate("GENERATOR")}
        />
        <MetricCard
          label="Saturation"
          value={`${metrics.saturation}%`}
          icon={<Activity size={20} />}
          color="amber"
          subtext={`Avg. Load: ${metrics.avgUtilization}%`}
          onClick={() => onNavigate && onNavigate("GENERATOR")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* SYSTEM HEALTH / ALERTS PANEL */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Activity size={20} className="text-slate-400" /> System Health
              </h3>
            </div>

            {issues.length === 0 && conflicts === 0 ? (
              <Card className="p-8 flex flex-col items-center justify-center text-center border-emerald-100 bg-emerald-50/30">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-emerald-900">All Systems Nominal</h4>
                <p className="text-emerald-700/80 max-w-md mt-2 text-sm">
                  Data integrity is perfect. Teachers, classes, and subjects are properly linked.
                  You are ready to generate a schedule.
                </p>
                <div className="mt-6">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                    onClick={() => onNavigate && onNavigate("GENERATOR")}
                  >
                    Go to Generator
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {conflicts > 0 && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-red-900">Schedule Conflicts Detected</h4>
                        <p className="text-xs text-red-700">
                          {conflicts} lessons could not be placed during the last run.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onNavigate && onNavigate("GENERATOR")}
                    >
                      Resolve
                    </Button>
                  </div>
                )}

                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border rounded-xl flex items-center justify-between shadow-sm ${
                      issue.type === "error"
                        ? "bg-orange-50 border-orange-100"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          issue.type === "error"
                            ? "bg-orange-100 text-orange-600"
                            : "bg-white dark:bg-slate-800 text-content-muted border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h4
                          className={`font-bold ${
                            issue.type === "error"
                              ? "text-orange-900"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          Data Attention Needed
                        </h4>
                        <p
                          className={`text-xs ${
                            issue.type === "error" ? "text-orange-700" : "text-content-muted"
                          }`}
                        >
                          {issue.message}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onNavigate && onNavigate(issue.view)}
                    >
                      {issue.action}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <RecentActivity />
        </div>

        {/* QUICK ACTIONS & LAST RUN */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <QuickAction
              icon={<Users size={18} />}
              label="Manage Faculty"
              desc="Add teachers or set constraints"
              onClick={() => onNavigate && onNavigate("TEACHERS")}
            />
            <QuickAction
              icon={<BookOpen size={18} />}
              label="Curriculum Setup"
              desc="Assign subjects to classes"
              onClick={() => onNavigate && onNavigate("CLASSES")}
            />
            <QuickAction
              icon={<Calendar size={18} />}
              label="Global Rules"
              desc="Set periods, breaks, and lunches"
              onClick={() => onNavigate && onNavigate("CONFIG")}
            />
            <QuickAction
              icon={<FileText size={18} />}
              label="Exam Planning"
              desc="Schedule school-wide assessments"
              onClick={() => onNavigate && onNavigate("EXAMS")}
            />
            <QuickAction
              icon={<Shield size={18} />}
              label="Duty Roster"
              desc="Assign supervision for breaks"
              onClick={() => onNavigate && onNavigate("DUTY")}
            />
          </div>

          <Card className="p-5 mt-4 bg-slate-900 text-white border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-sm text-slate-200">Last Optimization</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {data.lastGenerated ? new Date(data.lastGenerated).toLocaleString() : "Never run"}
                </p>
              </div>
              {data.lastGenerated && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Completed
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-400">
              Algorithm: <span className="text-slate-300">Constructive Heuristic v10 (Worker)</span>
            </div>
          </Card>
        </div>
      </div>

      {/* MODALS COMPONENT */}
      <ProfileModals
        createOpen={createModalOpen}
        setCreateOpen={setCreateModalOpen}
        loadOpen={loadModalOpen}
        setLoadOpen={setLoadModalOpen}
        newProfileName={newProfileName}
        setNewProfileName={setNewProfileName}
        savedProfiles={profiles}
        onCreate={async () => {
          await createNewProfile(newProfileName);
          setCreateModalOpen(false);
          setNewProfileName("");
        }}
        onLoad={async (id) => {
          await switchProfile(id);
          setLoadModalOpen(false);
        }}
      />
    </div>
  );
};
