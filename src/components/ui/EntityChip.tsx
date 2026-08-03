import React from "react";

interface EntityChipProps {
  /** Entity's identity colour (subject/class). Rendered as a swatch, never as text. */
  color?: string;
  label: string;
  className?: string;
  title?: string;
}

/**
 * Chip for a colour-identified entity (e.g. a subject on a teacher card).
 *
 * Colour-as-identity rule: the entity colour is shown as a **swatch**, and the
 * label uses a neutral token. Painting the label in the entity colour over a
 * tint of itself cannot reach WCAG AA for light hues — measured as low as
 * 1.33:1 for yellow subjects — and no single palette passes in both themes.
 * Keeping the swatch preserves recognisability while the text stays readable.
 */
export const EntityChip: React.FC<EntityChipProps> = ({ color, label, className = "", title }) => (
  <span
    title={title ?? label}
    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-edge bg-surface-muted px-2 py-0.5 text-2xs font-semibold text-content ${className}`}
  >
    {color && (
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: color }}
      />
    )}
    <span className="truncate">{label}</span>
  </span>
);
