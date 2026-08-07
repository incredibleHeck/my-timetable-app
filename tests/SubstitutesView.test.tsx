import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubstitutesView } from "../src/features/substitutes/SubstitutesView";
import { DEFAULT_DATA } from "../src/utils/constants";
import { AppData } from "../src/types";

const PERIODS = 4;

const baseSettings = {
  ...DEFAULT_DATA.settings,
  periodsPerDay: PERIODS,
  daysPerWeek: 5,
  dayStructure: Array(PERIODS)
    .fill(null)
    .map((_, i) => ({ type: "CLASS" as const, label: `P${i + 1}` })),
};

const teacher = (id: string, name: string, specialtyIds: string[] = []) => ({
  id,
  name,
  specialtyIds,
  constraints: Array(5)
    .fill(null)
    .map(() => Array(PERIODS).fill(false)),
});

const lesson = (subjectId: string, teacherId: string, roomId = "r1") => ({
  subjectId,
  teacherId,
  roomId,
  isLocked: false,
  classId: "c1",
});

/** A school where t1 teaches Monday P1 and P2, with several possible covers. */
const schoolWithLessons = (overrides: Partial<AppData> = {}): AppData =>
  ({
    ...DEFAULT_DATA,
    settings: baseSettings,
    subjects: [
      { id: "s1", name: "Mathematics", color: "#2563eb" },
      { id: "s2", name: "History", color: "#16a34a" },
    ],
    rooms: [{ id: "r1", name: "Room 101", capacity: 30, type: "GENERAL" }],
    teachers: [
      teacher("t1", "Absent Teacher", ["s1"]),
      teacher("t2", "Qualified Cover", ["s1"]),
      teacher("t3", "Other Subject", ["s2"]),
    ],
    classes: [{ id: "c1", name: "10A", defaultRoomId: "r1", curriculum: [] }],
    schedule: {
      c1: {
        0: { 0: lesson("s1", "t1"), 1: lesson("s1", "t1") },
      },
    },
    ...overrides,
  }) as AppData;

const selectAbsent = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const [absentSelect] = screen.getAllByRole("combobox");
  await user.selectOptions(absentSelect, value);
  return absentSelect as HTMLSelectElement;
};

describe("SubstitutesView", () => {
  it("renders the planner heading and the pre-selection prompt", () => {
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    expect(screen.getByText("Cover Planner")).toBeInTheDocument();
    expect(screen.getByText("Select a teacher to begin")).toBeInTheDocument();
  });

  it("lists teachers alphabetically regardless of input order", () => {
    const data = schoolWithLessons({
      teachers: [teacher("t3", "Zoe"), teacher("t1", "Adam"), teacher("t2", "Mia")],
    });
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    const [absentSelect] = screen.getAllByRole("combobox");
    const names = within(absentSelect)
      .getAllByRole("option")
      .map((o) => o.textContent)
      .slice(1); // drop the placeholder
    expect(names).toEqual(["Adam", "Mia", "Zoe"]);
  });

  it("offers one option per teaching day, capped by daysPerWeek", () => {
    const data = schoolWithLessons({
      settings: { ...baseSettings, daysPerWeek: 6 },
    } as Partial<AppData>);
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    const daySelect = screen.getAllByRole("combobox")[1];
    const days = within(daySelect)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(days).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  });

  it("falls back to a five-day week when daysPerWeek is absent", () => {
    const settings = { ...baseSettings } as Record<string, unknown>;
    delete settings.daysPerWeek;
    render(
      <SubstitutesView
        data={schoolWithLessons({ settings } as Partial<AppData>)}
        onUpdate={vi.fn()}
      />,
    );

    const daySelect = screen.getAllByRole("combobox")[1];
    expect(within(daySelect).getAllByRole("option")).toHaveLength(5);
  });

  it("shows the lessons needing cover once a teacher is chosen", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");

    // Scope to the summary strong element — the intro paragraph also contains
    // the word "lessons".
    expect(screen.getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("0 covered")).toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getAllByText("Mathematics")).toHaveLength(2);
  });

  it("reports nothing to cover when the teacher is free that day", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    // t2 teaches nothing at all.
    await selectAbsent(user, "t2");

    expect(screen.getByText("Nothing to cover")).toBeInTheDocument();
    expect(screen.getByText(/no scheduled lessons on Monday/i)).toBeInTheDocument();
  });

  it("names the selected day in the empty-state message", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t2");
    const daySelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(daySelect, "2");

    expect(screen.getByText(/no scheduled lessons on Wednesday/i)).toBeInTheDocument();
  });

  it("moves a lesson from open to covered when a substitute is picked", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    const coverSelects = screen.getAllByRole("combobox").slice(2);
    await user.selectOptions(coverSelects[0], "t2");

    expect(screen.getByText("1 covered")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
    expect(screen.getAllByText("Covered")).toHaveLength(1);
    expect(screen.getAllByText("Open")).toHaveLength(1);
  });

  it("clears an assignment when the selection is emptied", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    const coverSelects = screen.getAllByRole("combobox").slice(2);
    await user.selectOptions(coverSelects[0], "t2");
    expect(screen.getByText("1 covered")).toBeInTheDocument();

    await user.selectOptions(coverSelects[0], "");
    expect(screen.getByText("0 covered")).toBeInTheDocument();
    expect(screen.queryByText("Covered")).not.toBeInTheDocument();
  });

  it("drops existing assignments when the absent teacher changes", async () => {
    const user = userEvent.setup();
    const data = schoolWithLessons({
      schedule: {
        c1: {
          0: { 0: lesson("s1", "t1"), 1: lesson("s1", "t1") },
          1: { 0: lesson("s2", "t3") },
        },
      },
    } as Partial<AppData>);
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    await user.selectOptions(screen.getAllByRole("combobox").slice(2)[0], "t2");
    expect(screen.getByText("1 covered")).toBeInTheDocument();

    // Switching teacher must not carry the previous cover choices over.
    await selectAbsent(user, "t3");
    await selectAbsent(user, "t1");
    expect(screen.getByText("0 covered")).toBeInTheDocument();
  });

  it("drops existing assignments when the day changes", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    await user.selectOptions(screen.getAllByRole("combobox").slice(2)[0], "t2");
    expect(screen.getByText("1 covered")).toBeInTheDocument();

    const daySelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(daySelect, "1");
    await user.selectOptions(daySelect, "0");
    expect(screen.getByText("0 covered")).toBeInTheDocument();
  });

  it("marks candidates as subject-qualified or not", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    const coverSelect = screen.getAllByRole("combobox").slice(2)[0];
    const labels = within(coverSelect)
      .getAllByRole("option")
      .map((o) => o.textContent ?? "");

    expect(labels.some((l) => l.includes("Qualified Cover") && l.includes("✓ subject"))).toBe(true);
    expect(labels.some((l) => l.includes("Other Subject") && l.includes("other subject"))).toBe(
      true,
    );
  });

  it("says how many candidates are qualified and free", async () => {
    const user = userEvent.setup();
    render(<SubstitutesView data={schoolWithLessons()} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    const coverSelect = screen.getAllByRole("combobox").slice(2)[0];
    const placeholder = within(coverSelect).getAllByRole("option")[0].textContent ?? "";

    expect(placeholder).toMatch(/1 qualified & free/);
  });

  it("says so when no candidate teaches the subject", async () => {
    const user = userEvent.setup();
    const data = schoolWithLessons({
      teachers: [teacher("t1", "Absent Teacher", ["s1"]), teacher("t3", "Other Subject", ["s2"])],
    });
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");
    const coverSelect = screen.getAllByRole("combobox").slice(2)[0];
    const placeholder = within(coverSelect).getAllByRole("option")[0].textContent ?? "";

    expect(placeholder).toMatch(/no qualified match/);
  });

  it("warns when a period has no available teacher at all", async () => {
    const user = userEvent.setup();
    // The only other teacher is busy in both periods, so nothing can cover.
    const data = schoolWithLessons({
      teachers: [teacher("t1", "Absent Teacher", ["s1"]), teacher("t2", "Busy Teacher", ["s1"])],
      classes: [
        { id: "c1", name: "10A", defaultRoomId: "r1", curriculum: [] },
        { id: "c2", name: "10B", defaultRoomId: "r1", curriculum: [] },
      ],
      schedule: {
        c1: { 0: { 0: lesson("s1", "t1"), 1: lesson("s1", "t1") } },
        c2: {
          0: {
            0: { ...lesson("s1", "t2"), classId: "c2" },
            1: { ...lesson("s1", "t2"), classId: "c2" },
          },
        },
      },
    } as Partial<AppData>);
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");

    expect(screen.getAllByText(/No available teacher for this period/i)).toHaveLength(2);
  });

  it("uses the singular form for a single lesson", async () => {
    const user = userEvent.setup();
    const data = schoolWithLessons({
      schedule: { c1: { 0: { 0: lesson("s1", "t1") } } },
    } as Partial<AppData>);
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");

    expect(screen.getByText(/lesson$/)).toBeInTheDocument();
    expect(screen.queryByText("0 open")).not.toBeInTheDocument();
  });

  it("shows the room only when the lesson has one", async () => {
    const user = userEvent.setup();
    const data = schoolWithLessons({
      schedule: {
        c1: { 0: { 0: { ...lesson("s1", "t1"), roomId: undefined } } },
      },
    } as unknown as Partial<AppData>);
    render(<SubstitutesView data={data} onUpdate={vi.fn()} />);

    await selectAbsent(user, "t1");

    expect(screen.getByText("10A")).toBeInTheDocument();
    expect(screen.queryByText(/Room 101/)).not.toBeInTheDocument();
  });
});
