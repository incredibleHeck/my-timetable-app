import React, { useRef, useMemo } from "react";
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

  // Setup gaps worth surfacing on the tiles: the raw counts already appear as
  // badges in the sidebar, so the tiles should say what still needs attention.
  const classesNeedingCurriculum = useMemo(
    () => data.classes.filter((c) => c.curriculum.length === 0).length,
    [data.classes],
  );
  const unusedSubjects = useMemo(
    () =>
      data.subjects.filter(
        (s) => !data.classes.some((c) => c.curriculum.some((ci) => ci.subjectId === s.id)),
      ).length,
    [data.subjects, data.classes],
  );

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

      {/* PROFILE BAR
          Was a full-bleed hero whose largest element was a "Welcome back"
          greeting — the least informative thing on screen, occupying roughly a
          third of the first viewport. It now leads with the active profile and
          system status, keeping the brand panel but at about half the height. */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-900/30" />

        <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/30">
              <img src="/icon.png" alt="EduScheduler Pro" className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-none bg-amber-500 px-2 py-0.5 text-2xs font-black tracking-wide text-slate-900">
                  PRO SUITE 10.0
                </Badge>
                <span className="font-mono text-2xs font-bold uppercase tracking-widest text-amber-300">
                  {new Date().toLocaleDateString()}
                </span>
              </div>

              <p className="mt-1 truncate text-lg font-bold text-white md:text-xl">
                <strong>{profileName}</strong>
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

          {/* Profile management actions */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 md:w-auto">
            <Button
              icon={<Plus size={14} />}
              onClick={() => setCreateModalOpen(true)}
              size="sm"
              className="border-white/10 bg-white/10 text-white transition-all hover:bg-white/20"
            >
              New Profile
            </Button>
            <Button
              icon={<FolderOpen size={14} />}
              onClick={() => setLoadModalOpen(true)}
              size="sm"
              className="border-white/10 bg-white/10 text-white transition-all hover:bg-white/20"
            >
              Switch Profile
            </Button>
            <Button
              icon={<Upload size={14} />}
              onClick={handleExportBackup}
              size="sm"
              className="border-white/10 bg-white/10 text-white transition-all hover:bg-white/20"
            >
              Export JSON
            </Button>
            <Button
              icon={<Download size={14} />}
              onClick={handleImportClick}
              size="sm"
              className="border-white/10 bg-white/10 text-white transition-all hover:bg-white/20"
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
          // Previously "{n} classes" — a verbatim restatement of the value.
          // Surface the gap that needs action instead.
          subtext={
            classesNeedingCurriculum > 0
              ? `${classesNeedingCurriculum} need curriculum`
              : "All have curriculum"
          }
          onClick={() => onNavigate && onNavigate("CLASSES")}
        />
        <MetricCard
          label="Subjects"
          value={metrics.subjectCount}
          icon={<Layers size={20} />}
          color="violet"
          subtext={unusedSubjects > 0 ? `${unusedSubjects} unused` : "All in use"}
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
                <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                  All Systems Nominal
                </h4>
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
                        <h4 className="font-bold text-red-800 dark:text-red-200">
                          Schedule Conflicts Detected
                        </h4>
                        <p className="text-xs text-red-800 dark:text-red-200">
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
                              ? "text-orange-800 dark:text-orange-200"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          Data Attention Needed
                        </h4>
                        <p
                          className={`text-xs ${
                            issue.type === "error"
                              ? "text-orange-800 dark:text-orange-200"
                              : "text-content-muted"
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

          {/* Deliberately dark in both themes. The `!` modifiers are required:
              Card's own `bg-white` is emitted after `bg-slate-900` in Tailwind's
              output, so without them the card rendered white in light mode with
              near-invisible slate-200 text (measured 1.23:1). */}
          <Card className="p-5 mt-4 !bg-slate-900 text-white !border-slate-800">
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
