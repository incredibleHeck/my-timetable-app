import { describe, it, expect } from "vitest";

// Interface mimicking what we'll implement in ProfileContext or a separate hook
interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, state.past.length - 1);
  return {
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const newFuture = state.future.slice(1);
  return {
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}

function push<T>(state: HistoryState<T>, newPresent: T): HistoryState<T> {
  if (newPresent === state.present) return state;
  return {
    past: [...state.past, state.present],
    present: newPresent,
    future: [],
  };
}

describe("Undo/Redo Logic", () => {
  it("pushes new state and clears future", () => {
    let state: HistoryState<number> = { past: [], present: 1, future: [2] };
    state = push(state, 3);
    expect(state).toEqual({ past: [1], present: 3, future: [] });
  });

  it("undos state", () => {
    let state: HistoryState<number> = { past: [1], present: 2, future: [] };
    state = undo(state);
    expect(state).toEqual({ past: [], present: 1, future: [2] });
  });

  it("redos state", () => {
    let state: HistoryState<number> = { past: [], present: 1, future: [2] };
    state = redo(state);
    expect(state).toEqual({ past: [1], present: 2, future: [] });
  });

  it("does nothing if cannot undo/redo", () => {
    const initialState: HistoryState<number> = { past: [], present: 1, future: [] };
    expect(undo(initialState)).toBe(initialState);
    expect(redo(initialState)).toBe(initialState);
  });
});
