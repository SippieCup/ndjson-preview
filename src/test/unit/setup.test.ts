import { describe, it, expect } from 'vitest';
import {
  simpleObject,
  nestedObject,
  sampleNdjsonLines,
} from '../fixtures/sampleData';
import { collectAllKeys, deepEqual } from '../helpers';

describe('test infrastructure', () => {
  it('vitest is working', () => {
    expect(true).toBe(true);
  });

  it('fixtures load correctly', () => {
    expect(simpleObject).toEqual({ id: 1, name: 'Alice', active: true });
    expect(nestedObject.user.name).toBe('Alice');
    expect(sampleNdjsonLines).toHaveLength(5);
  });

  it('collectAllKeys helper works', () => {
    const keys = collectAllKeys({ a: 1, b: { c: 2, d: { e: 3 } } });
    expect(keys).toEqual(['a', 'b', 'b.c', 'b.d', 'b.d.e']);
  });

  it('collectAllKeys returns empty for non-objects', () => {
    expect(collectAllKeys(null)).toEqual([]);
    expect(collectAllKeys([1, 2])).toEqual([]);
    expect(collectAllKeys('string')).toEqual([]);
  });

  it('deepEqual helper works for matching objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('deepEqual helper detects mismatches', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, null)).toBe(false);
  });
});
