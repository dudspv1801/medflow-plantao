// Deterministic JSON stringify (sorts object keys recursively).
// Use this before hashing/signing so same object => same serialization.

export function stableStringify(value: unknown): string {
  const visited = new WeakSet();

  function replacer(key: string, val: any) {
    // Avoid cycles
    if (val && typeof val === 'object') {
      if (visited.has(val)) return '[Circular]';
      visited.add(val);
    }
    return val;
  }

  function sortKeys(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (typeof obj === 'object') {
      const sorted: any = {};
      const keys = Object.keys(obj).sort();
      for (const k of keys) sorted[k] = sortKeys(obj[k]);
      return sorted;
    }
    return obj;
  }

  const normalized = sortKeys(value);
  return JSON.stringify(normalized, replacer);
}
