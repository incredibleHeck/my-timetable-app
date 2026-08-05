import React, { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
  /** Accessible name. Not rendered — the surrounding row owns the visible label. */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Unit rendered after the field, e.g. "min". */
  unit?: string;
  id?: string;
  className?: string;
}

/**
 * Segmented `− n +` control. Typed input commits on blur or Enter rather than on
 * every keystroke: each commit is an undo entry, so per-keystroke commits meant
 * typing "24" recorded a step at "2" and briefly applied it.
 */
export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  unit,
  id,
  className = "",
}) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const step = (delta: number) => {
    const next = clamp(value + delta);
    if (next !== value) onChange(next);
  };

  const buttonClass =
    "grid h-full w-8 place-items-center text-content-muted transition-colors " +
    "hover:bg-surface-muted hover:text-content disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className="inline-flex h-9 items-center overflow-hidden rounded-md border border-edge bg-surface
                   transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30"
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => step(-1)}
          disabled={value <= min}
          className={buttonClass}
        >
          <Minus size={14} aria-hidden />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-full w-12 border-x border-edge bg-transparent text-center text-sm font-medium
                     tabular-nums text-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => step(1)}
          disabled={value >= max}
          className={buttonClass}
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>
      {unit && <span className="text-xs text-content-muted">{unit}</span>}
    </div>
  );
};
