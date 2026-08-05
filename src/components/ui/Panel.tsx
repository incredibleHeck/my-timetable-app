import React from "react";

/**
 * A titled surface with one hairline rhythm. Panels stack; they never nest —
 * bordered boxes inside bordered boxes are what made several views read as
 * noise rather than hierarchy.
 */
export const Panel: React.FC<{
  title: string;
  description?: string;
  /** Control belonging to the panel as a whole, or a summary value. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, children, className = "" }) => (
  <section className={`rounded-lg border border-edge bg-surface ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-content">{title}</h3>
        {description && (
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-content-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
    {children}
  </section>
);

/** A full-bleed region inside a panel — grids and tables set their own padding. */
export const PanelRegion: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`border-t border-edge ${className}`}>{children}</div>;

/** One control skin for text, number, time and select fields. */
export const controlClass =
  "h-9 rounded-md border border-edge bg-surface px-2.5 text-sm text-content tabular-nums " +
  "outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** Quiet secondary action: a button that reads as a control, not a call to action. */
export const quietButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-edge bg-surface px-3 text-sm " +
  "font-medium text-content-secondary transition-colors hover:border-edge-strong hover:text-content " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50";
