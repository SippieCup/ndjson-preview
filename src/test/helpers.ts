/**
 * Test helper utilities.
 */

/**
 * Collects all keys from an object (including nested) into a sorted array.
 * Useful for verifying no keys were lost or added during transformations.
 */
export function collectAllKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [];
  }
  const keys: string[] = [];
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    keys.push(
      ...collectAllKeys((obj as Record<string, unknown>)[key], fullKey),
    );
  }
  return keys.sort();
}

/**
 * Deep-compares two values for data parity (same data, possibly different key order).
 * Returns true if values are deeply equal regardless of key ordering.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    if (JSON.stringify(aKeys) !== JSON.stringify(bKeys)) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Asserts that two objects have the same keys (at top level) regardless of order.
 */
export function assertSameKeys(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): void {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `Key mismatch.\nActual: ${JSON.stringify(actualKeys)}\nExpected: ${JSON.stringify(expectedKeys)}`,
    );
  }
}
