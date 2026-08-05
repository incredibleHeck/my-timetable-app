import { Coffee, School, Users, Utensils, type LucideIcon } from "lucide-react";
import { PeriodType } from "../types";

export const PERIOD_TYPES: PeriodType[] = ["CLASS", "BREAK", "LUNCH", "ASSEMBLY"];

interface PeriodTypeMeta {
  /** Sentence case — these appear as option text, not as shouty tags. */
  label: string;
  icon: LucideIcon;
  /** Fill + hairline for a block that represents this type. */
  block: string;
  /** Text/icon colour that clears AA on `block` in both themes. */
  ink: string;
  /** Solid swatch for legend dots. */
  swatch: string;
}

/**
 * One source of truth for period-type colour. The timeline, the period list and
 * the reservations grid each declared their own map, and the amber/orange pair
 * two of them used was indistinguishable at block size.
 *
 * CLASS is deliberately neutral: it is the majority block, so tinting it drowned
 * out the breaks and assemblies it is supposed to contrast against.
 */
export const PERIOD_TYPE_META: Record<PeriodType, PeriodTypeMeta> = {
  CLASS: {
    label: "Class",
    icon: School,
    block: "bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600",
    ink: "text-slate-700 dark:text-slate-200",
    swatch: "bg-slate-400 dark:bg-slate-500",
  },
  BREAK: {
    label: "Break",
    icon: Coffee,
    block: "bg-sky-100 border-sky-300 dark:bg-sky-900/50 dark:border-sky-700",
    ink: "text-sky-800 dark:text-sky-200",
    swatch: "bg-sky-500",
  },
  LUNCH: {
    label: "Lunch",
    icon: Utensils,
    block: "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700",
    ink: "text-emerald-800 dark:text-emerald-200",
    swatch: "bg-emerald-500",
  },
  ASSEMBLY: {
    label: "Assembly",
    icon: Users,
    block: "bg-violet-100 border-violet-300 dark:bg-violet-900/50 dark:border-violet-700",
    ink: "text-violet-800 dark:text-violet-200",
    swatch: "bg-violet-500",
  },
};

export const periodTypeMeta = (type: PeriodType) =>
  PERIOD_TYPE_META[type] ?? PERIOD_TYPE_META.CLASS;
