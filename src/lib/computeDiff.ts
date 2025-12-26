// src/lib/computeDiff.ts
// Small utility to compute field-level before/after diffs
export function computeDiff(before: Record<string, any> | null, after: Record<string, any> | null) {
  const changes: Record<string, { before: any; after: any }> = {};
  const keys = new Set<string>();
  if (before) Object.keys(before).forEach((k) => keys.add(k));
  if (after) Object.keys(after).forEach((k) => keys.add(k));
  keys.forEach((k) => {
    const b = before ? before[k] : null;
    const a = after ? after[k] : null;
    // treat deep equality as needed; here simple JSON compare
    const eq = JSON.stringify(b) === JSON.stringify(a);
    if (!eq) changes[k] = { before: b, after: a };
  });
  return changes;
}
