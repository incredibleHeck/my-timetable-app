import React, { Suspense } from "react";
import { AppData, ViewState } from "../types";
import { DashboardView } from "../features/dashboard/DashboardView";
import { GlobalConfigView } from "../features/configuration/GlobalConfigView";
import { SubjectsView } from "../features/subjects/SubjectsView";
import { RoomsView } from "../features/rooms/RoomsView";
import { TeachersView } from "../features/teachers/TeachersView";
import { ClassesView } from "../features/classes/ClassesView";
import { WorkloadView } from "../features/workload/WorkloadView";

const GeneratorView = React.lazy(() =>
  import("../features/generator/GeneratorView").then((m) => ({
    default: m.GeneratorView,
  })),
);
const ExamsView = React.lazy(() =>
  import("../features/exams/ExamsView").then((m) => ({
    default: m.ExamsView,
  })),
);
const DutyView = React.lazy(() =>
  import("../features/duty/DutyView").then((m) => ({
    default: m.DutyView,
  })),
);

export const FULLSCREEN_VIEWS: ViewState[] = ["GENERATOR", "EXAMS", "DUTY"];

export const isFullScreenView = (view: ViewState): boolean => FULLSCREEN_VIEWS.includes(view);

const LazyComponentFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <span className="animate-spin text-3xl">⟳</span>
      <p className="text-slate-500">Loading feature...</p>
    </div>
  </div>
);

export interface ViewRouterProps {
  view: ViewState;
  data: AppData;
  onUpdate: (data: AppData) => void;
  onNavigate: (view: ViewState) => void;
  profileName?: string;
}

export const ViewRouter: React.FC<ViewRouterProps> = ({
  view,
  data,
  onUpdate,
  onNavigate,
  profileName,
}) => {
  switch (view) {
    case "DASHBOARD":
      return (
        <DashboardView
          data={data}
          onUpdate={onUpdate}
          profileName={profileName ?? ""}
          onNavigate={onNavigate}
        />
      );
    case "CONFIG":
      return (
        <GlobalConfigView
          data={data}
          onUpdate={onUpdate}
          profileName={profileName}
          onNavigate={onNavigate}
        />
      );
    case "SUBJECTS":
      return <SubjectsView data={data} onUpdate={onUpdate} />;
    case "ROOMS":
      return <RoomsView data={data} onUpdate={onUpdate} />;
    case "TEACHERS":
      return <TeachersView data={data} onUpdate={onUpdate} />;
    case "CLASSES":
      return <ClassesView data={data} onUpdate={onUpdate} />;
    case "WORKLOAD":
      return <WorkloadView data={data} onUpdate={onUpdate} />;
    case "GENERATOR":
      return (
        <Suspense fallback={<LazyComponentFallback />}>
          <GeneratorView data={data} onUpdate={onUpdate} onNavigate={onNavigate} />
        </Suspense>
      );
    case "EXAMS":
      return (
        <Suspense fallback={<LazyComponentFallback />}>
          <ExamsView data={data} onUpdate={onUpdate} onNavigate={onNavigate} />
        </Suspense>
      );
    case "DUTY":
      return (
        <Suspense fallback={<LazyComponentFallback />}>
          <DutyView data={data} onUpdate={onUpdate} onNavigate={onNavigate} />
        </Suspense>
      );
    default:
      return null;
  }
};
