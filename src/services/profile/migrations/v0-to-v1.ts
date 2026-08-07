/**
 * Migration step 0 -> 1:
 * Stamps schemaVersion: 1 on un-versioned legacy profiles.
 */
export function migrateV0ToV1(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    schemaVersion: 1,
  };
}
