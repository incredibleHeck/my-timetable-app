import React from "react";

/**
 * Empty, then green, then yellow, then red, in even quarters of the scale.
 * Past 75% the ramp has arrived at red and stays there, so the last quarter of
 * capacity reads as full regardless of how far over it goes.
 *
 * The first stop is the surface token rather than literal white so it means
 * "nothing here" in both themes: white on the light track, panel colour on the
 * dark one. Every stop is a token, so the bar re-colours with the theme.
 */
export const CAPACITY_GRADIENT =
  "linear-gradient(to right," +
  " rgb(var(--surface)) 0%," +
  " rgb(var(--success)) 25%," +
  " rgb(var(--accent)) 50%," +
  " rgb(var(--danger)) 75%)";

interface CapacityMeterProps {
  /** Percentage of capacity used. Values over 100 fill the track. */
  pct: number;
  /** Height and any extra layout classes, e.g. "h-[3px]". */
  className?: string;
  /** Describes the reading for screen readers; omit if stated in nearby text. */
  label?: string;
}

/**
 * The gradient sits on the full track and the unfilled remainder is masked, so
 * the colour at the tip always means the same thing regardless of how full the
 * bar is. Painting the gradient onto the fill itself would squeeze the whole
 * spectrum into a short bar, making a quiet teacher look scarlet.
 */
export const CapacityMeter: React.FC<CapacityMeterProps> = ({ pct, className = "", label }) => {
  const filled = Math.min(Math.max(pct, 0), 100);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-surface-inset ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <div className="absolute inset-0" style={{ backgroundImage: CAPACITY_GRADIENT }} />
      <div
        className="absolute inset-y-0 right-0 bg-surface-inset"
        style={{ width: `${100 - filled}%` }}
      />
    </div>
  );
};
