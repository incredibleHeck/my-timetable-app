import React from "react";
import { Panel } from "../../../components/ui";

/**
 * The configuration screen's panel is the shared `Panel` under another name —
 * this alias keeps the section files reading in their own vocabulary while the
 * surface itself stays identical to the one Teachers and other views use.
 */
export const ConfigPanel = Panel;

export { PanelRegion, controlClass } from "../../../components/ui";

/** Hairline-separated stack of `SettingRow`s. */
export const SettingRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border-t border-edge divide-y divide-edge-subtle">{children}</div>
);

/**
 * Label and explanation on the left, the control on the right. Every setting on
 * this screen uses this shape, which is what makes the sections feel related.
 */
export const SettingRow: React.FC<{
  title: string;
  description?: React.ReactNode;
  /** Set when the control is a single focusable field, so the label targets it. */
  htmlFor?: string;
  control: React.ReactNode;
}> = ({ title, description, htmlFor, control }) => {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="block text-sm font-medium text-content">
          {title}
        </Label>
        {description && (
          <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-content-muted">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">{control}</div>
    </div>
  );
};
