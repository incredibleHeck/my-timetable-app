import React from "react";

export interface DataTableColumn<T> {
  /** Column header text. */
  header: string;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Extra classes for this column's cells (e.g. width, alignment). */
  className?: string;
  /** Right-align numeric columns so digits line up. */
  numeric?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered instead of the table when there are no rows. */
  empty?: React.ReactNode;
}

/**
 * Compact table for list views whose records are genuinely tabular.
 *
 * The audit found several views rendering label/value pairs as card grids —
 * eight rooms of identical badges filling a screen that a table shows in a
 * fraction of the space. Cards earn their place when a record needs a distinct
 * visual identity; a uniform record set reads faster as rows.
 *
 * Uses a real <table> so screen readers get row/column semantics, and scrolls
 * horizontally inside its own container so the page never scrolls sideways.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-edge bg-surface shadow-sm">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-edge bg-surface-muted">
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className={`px-4 py-2.5 text-2xs font-bold uppercase tracking-wider text-content-muted ${
                  col.numeric ? "text-right" : "text-left"
                } ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-edge-subtle last:border-0 hover:bg-surface-muted transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-4 py-2.5 align-middle text-content ${
                    col.numeric ? "text-right tabular-nums" : "text-left"
                  } ${col.className ?? ""}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
