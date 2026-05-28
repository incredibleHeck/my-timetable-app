import { useCallback } from "react";
import { AppData, ActivityType } from "../../../types";
import { useProfile } from "../../../contexts/ProfileContext";
import { generateId } from "../../../utils/utils";

export type ConfigCommitFn = (message: string, nextData: AppData) => void;

export function useConfigCommit(
  data: AppData,
  onUpdate: (newData: AppData) => void,
): ConfigCommitFn {
  const { pushToHistory } = useProfile();

  return useCallback(
    (message: string, nextData: AppData) => {
      pushToHistory(data);
      onUpdate({
        ...nextData,
        recentActivity: [
          {
            id: generateId(),
            type: "SYSTEM" as ActivityType,
            message,
            timestamp: new Date().toISOString(),
          },
          ...(data.recentActivity || []),
        ].slice(0, 50),
      });
    },
    [data, onUpdate, pushToHistory],
  );
}
