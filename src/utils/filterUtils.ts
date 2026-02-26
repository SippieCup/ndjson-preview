import type { Filter } from '../types';
import { getNestedValue } from './jsonUtils';

/**
 * Check whether a parsed JSON object matches all given filters.
 * Each filter requires the nested key to exist and its stringified value to equal the filter value.
 */
export function matchesAllFilters(json: unknown, filters: Filter[]): boolean {
    for (const filter of filters) {
        const value = getNestedValue(json, filter.key);
        if (value === undefined || String(value) !== filter.value) {
            return false;
        }
    }
    return true;
}

/**
 * Given an array of raw NDJSON lines, return only those matching all filters.
 * Invalid JSON lines are silently skipped.
 */
export function filterLines(lines: string[], filters: Filter[]): string[] {
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        try {
            const json: unknown = JSON.parse(trimmed);
            if (matchesAllFilters(json, filters)) {
                result.push(trimmed);
            }
        } catch {
            // Skip invalid JSON
        }
    }

    return result;
}
