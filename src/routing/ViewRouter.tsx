import React, { Suspense } from "react";
import { AppData, ViewState } from "../types";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { DashboardView } from "../features/dashboard/DashboardView";
import { GlobalConfigView } from "../features/configuration/GlobalConfigView";
import { SubjectsView } from "../features/subjects/SubjectsView";
import { RoomsView } from "../features/rooms/RoomsView";
import { TeachersView } from "../features/teachers/TeachersView";
import { ClassesView } from "../features/classes/ClassesView";
import { WorkloadView } from "../features/workload/WorkloadView";
import { SubstitutesView } from "../features/substitutes/SubstitutesView";

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

const ViewErrorFallback = (view: ViewState, onNavigate: (view: ViewState) => void) =>
  function Fallback(error: Error, reset: () => void) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-white border border-red-200 rounded-lg shadow-sm p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-red-900 mb-1">This view hit an error</h2>
          <p className="text-slate-600 mb-4">
            The {view.toLowerCase()} screen couldn't render. Your data is safe — you can retry or
            switch to another view.
          </p>
          <details className="mb-6 p-3 bg-slate-100 rounded text-left text-sm">
            <summary className="font-mono text-slate-700 cursor-pointer">Error details</summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40 text-slate-600">
              {error.toString()}
            </pre>
          </details>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Try Again
            </button>
            <button
              onClick={() => onNavigate("DASHBOARD")}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  };

export const ViewRouter: React.FC<ViewRouterProps> = ({
  view,
  data,
  onUpdate,
  onNavigate,
  profileName,
}) => {
  const renderView = (): React.ReactNode => {
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
      case "SUBSTITUTES":
        return <SubstitutesView data={data} onUpdate={onUpdate} />;
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

  return (
    <ErrorBoundary key={view} fallback={ViewErrorFallback(view, onNavigate)}>
      {renderView()}
    </ErrorBoundary>
  );
};
