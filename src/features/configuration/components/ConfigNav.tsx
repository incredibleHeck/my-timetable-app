import React from "react";

export interface ConfigSection<Id extends string> {
  id: Id;
  label: string;
  /** Current value for the section, shown as a hint. Decorative — the panel states it too. */
  meta?: string;
}

interface ConfigNavProps<Id extends string> {
  sections: ConfigSection<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
}

/**
 * Vertical section rail. Replaces a horizontal tab strip: section names are
 * phrases rather than single words, and a rail can carry the current value of a
 * section beside its name without the row collapsing.
 *
 * Below `lg` it degrades to a horizontal scroller, where the meta is dropped.
 */
export const ConfigNav = <Id extends string>({
  sections,
  activeId,
  onSelect,
}: ConfigNavProps<Id>) => (
  <div
    role="tablist"
    aria-label="Configuration sections"
    aria-orientation="vertical"
    className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
  >
    {sections.map((section) => {
      const isActive = section.id === activeId;
      return (
        <button
          key={section.id}
          type="button"
          role="tab"
          id={`config-tab-${section.id}`}
          aria-selected={isActive}
          aria-controls={`config-panel-${section.id}`}
          aria-label={section.label}
          tabIndex={isActive ? 0 : -1}
          onClick={() => onSelect(section.id)}
          className={`group flex shrink-0 items-baseline justify-between gap-3 whitespace-nowrap rounded-md
                      border-l-2 px-3 py-2 text-left text-sm transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                      focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
                      lg:w-full lg:whitespace-normal ${
                        isActive
                          ? "border-l-accent bg-surface font-medium text-content"
                          : "border-l-transparent text-content-muted hover:bg-surface/60 hover:text-content-secondary"
                      }`}
        >
          <span>{section.label}</span>
          {section.meta && (
            <span
              aria-hidden
              className={`hidden text-xs tabular-nums lg:inline ${
                isActive ? "text-content-muted" : "text-content-muted/70"
              }`}
            >
              {section.meta}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
