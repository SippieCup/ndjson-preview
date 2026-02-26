import { describe, it, expect } from 'vitest';
import { matchesAllFilters, filterLines } from '../../utils/filterUtils';
import type { Filter } from '../../types';
import {
  sampleNdjsonLines,
  nestedObject,
  simpleObject,
  nullValuesObject,
} from '../fixtures/sampleData';

// ============================================================
// matchesAllFilters
// ============================================================

describe('matchesAllFilters', () => {
  it('returns true when no filters', () => {
    expect(matchesAllFilters(simpleObject, [])).toBe(true);
  });

  it('matches a single top-level filter', () => {
    const filters: Filter[] = [{ key: 'name', value: 'Alice' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(true);
  });

  it('rejects when value does not match', () => {
    const filters: Filter[] = [{ key: 'name', value: 'Bob' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(false);
  });

  it('rejects when key does not exist', () => {
    const filters: Filter[] = [{ key: 'missing', value: 'anything' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(false);
  });

  it('matches nested key with dot notation', () => {
    const filters: Filter[] = [{ key: 'user.name', value: 'Alice' }];
    expect(matchesAllFilters(nestedObject, filters)).toBe(true);
  });

  it('rejects nested key when value differs', () => {
    const filters: Filter[] = [{ key: 'user.name', value: 'Bob' }];
    expect(matchesAllFilters(nestedObject, filters)).toBe(false);
  });

  it('matches multiple filters (ALL must match)', () => {
    const filters: Filter[] = [
      { key: 'id', value: '1' },
      { key: 'user.name', value: 'Alice' },
    ];
    expect(matchesAllFilters(nestedObject, filters)).toBe(true);
  });

  it('rejects when one of multiple filters fails', () => {
    const filters: Filter[] = [
      { key: 'id', value: '1' },
      { key: 'user.name', value: 'Bob' }, // This won't match
    ];
    expect(matchesAllFilters(nestedObject, filters)).toBe(false);
  });

  it('stringifies numeric values for comparison', () => {
    const filters: Filter[] = [{ key: 'id', value: '1' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(true);
  });

  it('stringifies boolean values for comparison', () => {
    const filters: Filter[] = [{ key: 'active', value: 'true' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(true);
  });

  it('handles null values (String(null) = "null")', () => {
    const filters: Filter[] = [{ key: 'name', value: 'null' }];
    expect(matchesAllFilters(nullValuesObject, filters)).toBe(true);
  });

  it('rejects undefined values (key not found)', () => {
    const filters: Filter[] = [{ key: 'nonexistent', value: 'undefined' }];
    expect(matchesAllFilters(simpleObject, filters)).toBe(false);
  });

  it('handles empty object', () => {
    expect(matchesAllFilters({}, [])).toBe(true);
    expect(matchesAllFilters({}, [{ key: 'a', value: '1' }])).toBe(false);
  });
});

// ============================================================
// filterLines
// ============================================================

describe('filterLines', () => {
  it('returns all lines when no filters', () => {
    const result = filterLines(sampleNdjsonLines, []);
    expect(result).toHaveLength(sampleNdjsonLines.length);
  });

  it('filters by top-level key', () => {
    const filters: Filter[] = [{ key: 'status', value: 'active' }];
    const result = filterLines(sampleNdjsonLines, filters);
    // Lines 1, 3, 4 have status "active"
    expect(result).toHaveLength(3);

    // Verify data parity: each result line should parse to an object with status=active
    for (const line of result) {
      const obj = JSON.parse(line);
      expect(obj.status).toBe('active');
    }
  });

  it('filters by nested key', () => {
    const filters: Filter[] = [{ key: 'user.role', value: 'admin' }];
    const result = filterLines(sampleNdjsonLines, filters);
    // Lines 1, 4 have user.role "admin"
    expect(result).toHaveLength(2);

    for (const line of result) {
      const obj = JSON.parse(line);
      expect(obj.user.role).toBe('admin');
    }
  });

  it('filters with multiple filters (AND logic)', () => {
    const filters: Filter[] = [
      { key: 'status', value: 'active' },
      { key: 'user.role', value: 'admin' },
    ];
    const result = filterLines(sampleNdjsonLines, filters);
    // Lines 1, 4 are active admins
    expect(result).toHaveLength(2);

    for (const line of result) {
      const obj = JSON.parse(line);
      expect(obj.status).toBe('active');
      expect(obj.user.role).toBe('admin');
    }
  });

  it('returns empty array when no lines match', () => {
    const filters: Filter[] = [{ key: 'status', value: 'deleted' }];
    const result = filterLines(sampleNdjsonLines, filters);
    expect(result).toHaveLength(0);
  });

  it('skips empty lines', () => {
    const linesWithEmpty = ['', '  ', ...sampleNdjsonLines, '', '  '];
    const filters: Filter[] = [{ key: 'status', value: 'active' }];
    const result = filterLines(linesWithEmpty, filters);
    expect(result).toHaveLength(3);
  });

  it('skips invalid JSON lines', () => {
    const linesWithInvalid = [
      '{invalid json}',
      '{"status":"active","id":99}',
      'not json at all',
      '{"status":"active","id":100}',
    ];
    const filters: Filter[] = [{ key: 'status', value: 'active' }];
    const result = filterLines(linesWithInvalid, filters);
    expect(result).toHaveLength(2);

    // Verify the valid lines were returned intact
    expect(result[0]).toBe('{"status":"active","id":99}');
    expect(result[1]).toBe('{"status":"active","id":100}');
  });

  it('trims lines before parsing', () => {
    const lines = ['  {"status":"active","id":1}  ', '\t{"status":"active","id":2}\t'];
    const filters: Filter[] = [{ key: 'status', value: 'active' }];
    const result = filterLines(lines, filters);
    expect(result).toHaveLength(2);
    // Results should be trimmed
    for (const line of result) {
      expect(line).not.toMatch(/^\s/);
      expect(line).not.toMatch(/\s$/);
    }
  });

  it('returns empty array for empty input', () => {
    const result = filterLines([], [{ key: 'a', value: '1' }]);
    expect(result).toHaveLength(0);
  });

  it('preserves original line content in results', () => {
    const lines = ['{"id":1,"extra":"data","status":"active"}'];
    const filters: Filter[] = [{ key: 'status', value: 'active' }];
    const result = filterLines(lines, filters);
    expect(result).toHaveLength(1);

    // The returned line should be parseable and contain ALL original fields
    const parsed = JSON.parse(result[0]);
    expect(parsed.id).toBe(1);
    expect(parsed.extra).toBe('data');
    expect(parsed.status).toBe('active');
  });

  it('handles filtering by numeric id', () => {
    const filters: Filter[] = [{ key: 'id', value: '3' }];
    const result = filterLines(sampleNdjsonLines, filters);
    expect(result).toHaveLength(1);
    const parsed = JSON.parse(result[0]);
    expect(parsed.id).toBe(3);
    expect(parsed.user.name).toBe('Charlie');
  });
});
