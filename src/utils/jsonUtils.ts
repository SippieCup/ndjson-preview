/**
 * Reorder JSON keys so that primitive values come before objects/arrays.
 * Applied recursively to all nested objects.
 */
export function reorderJsonKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => reorderJsonKeys(item));
    }

    const record = obj as Record<string, unknown>;
    const primitives: Record<string, unknown> = {};
    const objects: Record<string, unknown> = {};

    for (const key of Object.keys(record)) {
        const value = record[key];
        if (value !== null && typeof value === 'object') {
            objects[key] = reorderJsonKeys(value);
        } else {
            primitives[key] = value;
        }
    }

    return { ...primitives, ...objects };
}

/**
 * Reorder JSON keys according to a custom ordering.
 * Keys in `order` appear first (in that sequence), followed by remaining keys.
 * Applied recursively to all nested objects.
 */
export function applyCustomOrder(obj: unknown, order: string[]): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => applyCustomOrder(item, order));
    }

    const record = obj as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    const remaining: Record<string, unknown> = {};

    for (const key of order) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            const value = record[key];
            ordered[key] = (value !== null && typeof value === 'object')
                ? applyCustomOrder(value, order)
                : value;
        }
    }

    for (const key of Object.keys(record)) {
        if (!order.includes(key)) {
            const value = record[key];
            remaining[key] = (value !== null && typeof value === 'object')
                ? applyCustomOrder(value, order)
                : value;
        }
    }

    return { ...ordered, ...remaining };
}

/**
 * Access a nested value using dot-notation (e.g., "user.email").
 */
export function getNestedValue(obj: unknown, key: string): unknown {
    const keys = key.split('.');
    let value: unknown = obj;

    for (const k of keys) {
        if (value === null || value === undefined) {
            return undefined;
        }
        value = (value as Record<string, unknown>)[k];
    }

    return value;
}

/**
 * Recursively decode URI-encoded strings in a JSON object.
 * 1. Applies decodeURIComponent() to all string values.
 * 2. If the decoded string looks like JSON (starts with { or [), attempts
 *    JSON.parse(). On success the parsed value replaces the string and is
 *    itself decoded recursively.
 * Invalid URI sequences (e.g., %ZZ) are left as-is.
 * Non-string values pass through unchanged.
 * maxDepth guards against runaway recursion (default 10).
 */
export function decodeUriStrings(obj: unknown, maxDepth = 10): unknown {
    if (maxDepth <= 0) {
        return obj;
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        let decoded: string;
        try {
            decoded = decodeURIComponent(obj);
        } catch {
            decoded = obj;
        }

        const trimmed = decoded.trimStart();
        if (trimmed.length > 0 && (trimmed[0] === '{' || trimmed[0] === '[')) {
            try {
                const parsed: unknown = JSON.parse(decoded);
                return decodeUriStrings(parsed, maxDepth - 1);
            } catch {
                // Not valid JSON — return decoded string as-is
            }
        }

        return decoded;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => decodeUriStrings(item, maxDepth));
    }

    if (typeof obj === 'object') {
        const record = obj as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(record)) {
            result[key] = decodeUriStrings(record[key], maxDepth);
        }
        return result;
    }

    return obj;
}

