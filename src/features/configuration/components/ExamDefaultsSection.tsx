import React from "react";
import { AppData } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";
import { ConfigPanel, SettingRow, SettingRows, controlClass } from "./ConfigPanel";

interface ExamDefaultsSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  updateExamGrid: (patch: Partial<NonNullable<AppData["settings"]["examGrid"]>>) => AppData;
}

export const ExamDefaultsSection: React.FC<ExamDefaultsSectionProps> = ({
  data,
  commit,
  updateExamGrid,
}) => {
  const grid = data.settings.examGrid;
  const sessionsPerDay = grid?.sessionsPerDay ?? 2;

  const timeRow = (
    key: "sessionCutoff" | "session1DefaultTime" | "session2DefaultTime",
    title: string,
    description: string,
    fallback: string,
    disabled = false,
  ) => (
    <SettingRow
      title={title}
      description={description}
      htmlFor={`exam-${key}`}
      control={
        <input
          id={`exam-${key}`}
          type="time"
          disabled={disabled}
          value={grid?.[key] || fallback}
          onChange={(e) =>
            commit(`Updated exam ${title}`, updateExamGrid({ [key]: e.target.value }))
          }
          className={`${controlClass} w-28`}
        />
      }
    />
  );

  return (
    <ConfigPanel
      title="Exam defaults"
      description="Starting point for new exam timetables. Individual exams can still be moved once scheduled."
    >
      <SettingRows>
        <SettingRow
          title="Sessions per day"
          description="One session runs a single sitting each day; two split the day into morning and afternoon."
          control={
            <div
              role="radiogroup"
              aria-label="Sessions per day"
              className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
            >
              {[1, 2].map((n) => {
                const isActive = sessionsPerDay === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() =>
                      commit(
                        `Exam sessions per day set to ${n}`,
                        updateExamGrid({ sessionsPerDay: n }),
                      )
                    }
                    className={`h-8 w-10 rounded text-sm tabular-nums transition-colors
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                  isActive
                                    ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                    : "text-content-muted hover:text-content"
                                }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          }
        />

        {timeRow(
          "session1DefaultTime",
          sessionsPerDay === 1 ? "Session start" : "Morning session start",
          "Default start time given to a newly scheduled exam.",
          "09:00",
        )}

        {sessionsPerDay === 2 && (
          <>
            {timeRow(
              "session2DefaultTime",
              "Afternoon session start",
              "Default start time for exams placed in the second session.",
              "14:00",
            )}
            {timeRow(
              "sessionCutoff",
              "Session boundary",
              "Exams starting before this time count as morning; anything later is afternoon.",
              "11:30",
            )}
          </>
        )}
      </SettingRows>
    </ConfigPanel>
  );
};
