import React, { createContext, useContext, ReactNode } from "react";
import { AppData } from "../types";

interface HistoryContextType {
  undo: () => void;
  redo: () => void;
  pushToHistory: (data?: AppData) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: HistoryContextType;
}) => <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
};
