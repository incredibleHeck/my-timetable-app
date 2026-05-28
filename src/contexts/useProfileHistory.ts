import { useCallback, useState } from "react";
import { AppData } from "../types";
import { deepClone } from "../utils/utils";

const MAX_HISTORY = 50;

interface UseProfileHistoryOptions {
  getCurrentData: () => AppData | null;
  applyData: (data: AppData) => void;
}

export function useProfileHistory({ getCurrentData, applyData }: UseProfileHistoryOptions) {
  const [past, setPast] = useState<AppData[]>([]);
  const [future, setFuture] = useState<AppData[]>([]);

  const resetHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const pushToHistory = useCallback(
    (_data?: AppData) => {
      const current = getCurrentData();
      if (!current) return;

      setPast((prevPast) => {
        const newPast = [...prevPast, deepClone(current)];
        if (newPast.length > MAX_HISTORY) {
          return newPast.slice(newPast.length - MAX_HISTORY);
        }
        return newPast;
      });
      setFuture([]);
    },
    [getCurrentData],
  );

  const undo = useCallback(() => {
    const current = getCurrentData();
    if (!current) return;

    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setFuture((prevFuture) => [deepClone(current), ...prevFuture]);
      applyData(previous);
      return prevPast.slice(0, prevPast.length - 1);
    });
  }, [applyData, getCurrentData]);

  const redo = useCallback(() => {
    const current = getCurrentData();
    if (!current) return;

    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setPast((prevPast) => [...prevPast, deepClone(current)]);
      applyData(next);
      return prevFuture.slice(1);
    });
  }, [applyData, getCurrentData]);

  return {
    pushToHistory,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetHistory,
  };
}
