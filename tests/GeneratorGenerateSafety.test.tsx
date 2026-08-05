import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeneratorView } from "../src/features/generator/GeneratorView";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

/** Captures the worker so the test can decide whether it ever reports back. */
class StubWorker {
  static instances: StubWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  posted: unknown[] = [];

  constructor() {
    StubWorker.instances.push(this);
  }
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  terminate() {}
}

describe("GeneratorView generation safety", () => {
  const onUpdate = vi.fn();

  const schedulable: AppData = {
    ...DEFAULT_DATA,
    subjects: [{ id: "s1", name: "Maths", color: "#2dd4bf" }],
    teachers: [
      {
        id: "t1",
        name: "Alice",
        specialtyIds: ["s1"],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(DEFAULT_DATA.settings.periodsPerDay).fill(false)),
      },
    ],
    classes: [
      {
        id: "c1",
        name: "10A",
        defaultRoomId: "",
        curriculum: [
          {
            id: "cur1",
            subjectId: "s1",
            periodsPerWeek: 2,
            singles: 2,
            doubles: 0,
            assignedTeacherId: "t1",
          },
        ],
      },
    ],
    // A pre-existing timetable is the thing that must survive.
    schedule: {
      c1: { 0: { 0: { subjectId: "s1", teacherId: "t1", classId: "c1" } } },
    },
    lastGenerated: new Date().toISOString(),
  } as unknown as AppData;

  beforeEach(() => {
    onUpdate.mockClear();
    StubWorker.instances = [];
    vi.stubGlobal("Worker", StubWorker);
  });

  afterEach(() => vi.unstubAllGlobals());

  // handleGenerate used to commit `schedule: {}` before starting the worker, so
  // the UI "showed Empty during generation". A worker error, or stopping before
  // the first clean result, then left the profile with no timetable at all and
  // nothing on screen offering it back.
  it("keeps the existing timetable on screen until a result arrives", () => {
    render(<GeneratorView data={schedulable} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /Regenerate|Generate Schedule/ }));

    expect(StubWorker.instances).toHaveLength(1);
    // The worker still receives a cleared grid to solve from...
    expect(StubWorker.instances[0].posted[0]).toMatchObject({ schedule: {} });
    // ...but nothing was written back to the profile.
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("leaves the timetable intact when the worker reports an error", () => {
    render(<GeneratorView data={schedulable} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /Regenerate|Generate Schedule/ }));
    StubWorker.instances[0].onmessage?.({
      data: { type: "error", payload: { message: "boom" } },
    } as MessageEvent);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
