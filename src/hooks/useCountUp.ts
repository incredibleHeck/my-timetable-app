import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value from its previous state to the new target.
 * Returns the current animated value (rounded integer).
 */
export const useCountUp = (target: number, duration = 700): number => {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const start = prevTargetRef.current;
    const end = target;
    if (start === end) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTargetRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
};
