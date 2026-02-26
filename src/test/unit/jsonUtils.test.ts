import { describe, it, expect } from 'vitest';
import {
  reorderJsonKeys,
  applyCustomOrder,
  getNestedValue,
  decodeUriStrings,
} from '../../utils/jsonUtils';
import { escapeHtml } from '../../utils/htmlUtils';
import {
  simpleObject,
  nestedObject,
  deeplyNestedObject,
  emptyObject,
  nullValuesObject,
  arrayValuesObject,
  mixedTypesObject,
  specialCharsObject,
  reorderTestObject,
  reorderExpected,
  customOrderTestObject,
  customOrderExpected,
} from '../fixtures/sampleData';
import { collectAllKeys, deepEqual } from '../helpers';

// ============================================================
// reorderJsonKeys
// ============================================================

describe('reorderJsonKeys', () => {
  it('places primitives before objects/arrays', () => {
    const result = reorderJsonKeys(reorderTestObject) as Record<string, unknown>;
    const keys = Object.keys(result);

    // Find the boundary: last primitive index should be before first object index
    const firstObjIdx = keys.findIndex(
      (k) => result[k] !== null && typeof result[k] === 'object',
    );
    const lastPrimIdx =
      keys.length -
      1 -
      [...keys]
        .reverse()
        .findIndex(
          (k) => result[k] === null || typeof result[k] !== 'object',
        );
    expect(lastPrimIdx).toBeLessThan(firstObjIdx);
  });

  it('preserves all data (field-by-field parity)', () => {
    const result = reorderJsonKeys(reorderTestObject) as Record<string, unknown>;

    // Every original value must be preserved
    expect(result.alpha).toBe(1);
    expect(result.beta).toBe('hello');
    expect(result.delta).toBeNull();
    expect(result.zeta).toEqual({ nested: true });
    expect(result.gamma).toEqual([1, 2]);
    expect((result.epsilon as Record<string, unknown>).deep).toEqual({ value: 42 });
  });

  it('preserves all keys (no keys lost or added)', () => {
    const result = reorderJsonKeys(reorderTestObject) as Record<string, unknown>;
    const inputKeys = JSON.stringify(Object.keys(reorderTestObject).sort());
    const resultKeys = JSON.stringify(Object.keys(result).sort());
    expect(resultKeys).toBe(inputKeys);
  });

  it('matches expected output', () => {
    const result = reorderJsonKeys(reorderTestObject);
    expect(result).toEqual(reorderExpected);
    // Also verify key order matches
    expect(Object.keys(result as object)).toEqual(Object.keys(reorderExpected));
  });

  it('recursively reorders nested objects', () => {
    const input = {
      outer: { z_obj: { inner: true }, a_prim: 1 },
      top_prim: 'hello',
    };
    const result = reorderJsonKeys(input) as Record<string, unknown>;

    // Top level: top_prim before outer
    expect(Object.keys(result)[0]).toBe('top_prim');

    // Nested: a_prim before z_obj
    const outer = result.outer as Record<string, unknown>;
    expect(Object.keys(outer)[0]).toBe('a_prim');
    expect(Object.keys(outer)[1]).toBe('z_obj');
  });

  it('handles simple flat object', () => {
    const result = reorderJsonKeys(simpleObject) as Record<string, unknown>;
    // All values are primitives so order should be original order
    expect(result).toEqual(simpleObject);
    expect(deepEqual(result, simpleObject)).toBe(true);
  });

  it('handles nested object with arrays', () => {
    const result = reorderJsonKeys(nestedObject) as Record<string, unknown>;

    // Primitives (id) first, then objects (user, tags)
    const keys = Object.keys(result);
    expect(keys[0]).toBe('id');
    expect(result.id).toBe(1);
    expect(result.user).toEqual({ name: 'Alice', email: 'alice@example.com' });
    expect(result.tags).toEqual(['admin', 'user']);
  });

  it('handles deeply nested objects recursively', () => {
    const result = reorderJsonKeys(deeplyNestedObject);
    expect(result).toEqual(deeplyNestedObject);
    // Verify deep parity
    const inputKeys = collectAllKeys(deeplyNestedObject);
    const resultKeys = collectAllKeys(result);
    expect(resultKeys).toEqual(inputKeys);
  });

  it('returns empty object for empty input', () => {
    const result = reorderJsonKeys(emptyObject);
    expect(result).toEqual({});
    expect(Object.keys(result as object)).toHaveLength(0);
  });

  it('preserves null values as primitives', () => {
    const result = reorderJsonKeys(nullValuesObject) as Record<string, unknown>;
    expect(result.name).toBeNull();
    expect(result.data).toBeNull();
    expect(result.id).toBe(1);
    // All are primitives (null counts as primitive), keys preserved
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(nullValuesObject).sort(),
    );
  });

  it('handles arrays as values (arrays are objects)', () => {
    const result = reorderJsonKeys(arrayValuesObject) as Record<string, unknown>;
    // Both values are arrays (objects), so order is preserved
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('handles mixed types correctly', () => {
    const result = reorderJsonKeys(mixedTypesObject) as Record<string, unknown>;

    // Primitives: str, num, bool, nil
    // Objects: arr, obj
    expect(result.str).toBe('hello');
    expect(result.num).toBe(42);
    expect(result.bool).toBe(true);
    expect(result.nil).toBeNull();
    expect(result.arr).toEqual([1, 'two']);
    expect((result.obj as Record<string, unknown>).nested).toBe(true);

    // Verify no keys lost
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(mixedTypesObject).sort(),
    );
  });

  it('returns primitives unchanged', () => {
    expect(reorderJsonKeys(null)).toBeNull();
    expect(reorderJsonKeys(42)).toBe(42);
    expect(reorderJsonKeys('hello')).toBe('hello');
    expect(reorderJsonKeys(true)).toBe(true);
    expect(reorderJsonKeys(undefined)).toBeUndefined();
  });

  it('maps over arrays and reorders each element', () => {
    const input = [
      { obj: { nested: true }, prim: 1 },
      { another: { deep: 'val' }, first: 'hello' },
    ];
    const result = reorderJsonKeys(input) as Record<string, unknown>[];

    expect(Object.keys(result[0])[0]).toBe('prim');
    expect(Object.keys(result[1])[0]).toBe('first');

    // Data parity
    expect(result[0].prim).toBe(1);
    expect(result[0].obj).toEqual({ nested: true });
    expect(result[1].first).toBe('hello');
    expect(result[1].another).toEqual({ deep: 'val' });
  });

  it('preserves object with single key', () => {
    expect(reorderJsonKeys({ only: 'one' })).toEqual({ only: 'one' });
  });

  it('handles boolean false and zero correctly (falsy primitives)', () => {
    const input = { flag: false, count: 0, name: '', data: { x: 1 } };
    const result = reorderJsonKeys(input) as Record<string, unknown>;

    expect(result.flag).toBe(false);
    expect(result.count).toBe(0);
    expect(result.name).toBe('');
    expect(result.data).toEqual({ x: 1 });

    // Primitives (flag, count, name) before objects (data)
    const keys = Object.keys(result);
    const dataIdx = keys.indexOf('data');
    expect(keys.indexOf('flag')).toBeLessThan(dataIdx);
    expect(keys.indexOf('count')).toBeLessThan(dataIdx);
    expect(keys.indexOf('name')).toBeLessThan(dataIdx);
  });
});

// ============================================================
// applyCustomOrder
// ============================================================

describe('applyCustomOrder', () => {
  it('places specified keys first in order', () => {
    const order = ['id', 'name', 'email'];
    const result = applyCustomOrder(customOrderTestObject, order) as Record<string, unknown>;
    const keys = Object.keys(result);
    expect(keys[0]).toBe('id');
    expect(keys[1]).toBe('name');
    expect(keys[2]).toBe('email');
  });

  it('preserves all data (field-by-field parity)', () => {
    const order = ['id', 'name', 'email'];
    const result = applyCustomOrder(customOrderTestObject, order) as Record<string, unknown>;

    expect(result.id).toBe(1);
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.status).toBe('active');
    expect(result.role).toBe('admin');
  });

  it('preserves all keys (no keys lost or added)', () => {
    const order = ['id', 'name', 'email'];
    const result = applyCustomOrder(customOrderTestObject, order) as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(customOrderTestObject).sort(),
    );
  });

  it('matches expected output', () => {
    const order = ['id', 'name', 'email'];
    const result = applyCustomOrder(customOrderTestObject, order);
    expect(result).toEqual(customOrderExpected);
    expect(Object.keys(result as object)).toEqual(Object.keys(customOrderExpected));
  });

  it('appends remaining keys after ordered ones', () => {
    const order = ['name'];
    const result = applyCustomOrder(customOrderTestObject, order) as Record<string, unknown>;
    expect(Object.keys(result)[0]).toBe('name');
    // Remaining keys should follow
    expect(Object.keys(result).slice(1).sort()).toEqual(
      Object.keys(customOrderTestObject)
        .filter((k) => k !== 'name')
        .sort(),
    );
  });

  it('handles order keys not present in object', () => {
    const order = ['nonexistent', 'id', 'also_missing'];
    const result = applyCustomOrder(customOrderTestObject, order) as Record<string, unknown>;
    // Only 'id' exists, should be first
    expect(Object.keys(result)[0]).toBe('id');
    // Total keys unchanged
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(customOrderTestObject).sort(),
    );
  });

  it('with empty order returns original key order', () => {
    const result = applyCustomOrder(customOrderTestObject, []) as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(Object.keys(customOrderTestObject));
    expect(result).toEqual(customOrderTestObject);
  });

  it('recursively applies custom order to nested objects', () => {
    const input = {
      id: 1,
      user: { role: 'admin', name: 'Alice', id: 100 },
      status: 'active',
    };
    const order = ['id', 'name'];
    const result = applyCustomOrder(input, order) as Record<string, unknown>;

    // Top level: id first
    expect(Object.keys(result)[0]).toBe('id');

    // Nested: id and name first in user
    const user = result.user as Record<string, unknown>;
    expect(Object.keys(user)[0]).toBe('id');
    expect(Object.keys(user)[1]).toBe('name');
    expect(user.role).toBe('admin');
  });

  it('handles arrays by mapping each element', () => {
    const input = [
      { z: 3, a: 1, b: 2 },
      { z: 6, a: 4, b: 5 },
    ];
    const order = ['a', 'b'];
    const result = applyCustomOrder(input, order) as Record<string, unknown>[];

    expect(Object.keys(result[0])).toEqual(['a', 'b', 'z']);
    expect(Object.keys(result[1])).toEqual(['a', 'b', 'z']);
    // Data parity
    expect(result[0].a).toBe(1);
    expect(result[1].z).toBe(6);
  });

  it('returns primitives unchanged', () => {
    expect(applyCustomOrder(null, ['a'])).toBeNull();
    expect(applyCustomOrder(42, ['a'])).toBe(42);
    expect(applyCustomOrder('hello', ['a'])).toBe('hello');
    expect(applyCustomOrder(true, ['a'])).toBe(true);
  });

  it('returns empty object for empty input', () => {
    const result = applyCustomOrder(emptyObject, ['a', 'b']);
    expect(result).toEqual({});
  });

  it('preserves null values in ordered and remaining', () => {
    const input = { c: null, a: 1, b: null };
    const order = ['b', 'a'];
    const result = applyCustomOrder(input, order) as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(['b', 'a', 'c']);
    expect(result.b).toBeNull();
    expect(result.c).toBeNull();
    expect(result.a).toBe(1);
  });
});

// ============================================================
// getNestedValue
// ============================================================

describe('getNestedValue', () => {
  it('accesses top-level keys', () => {
    expect(getNestedValue(simpleObject, 'id')).toBe(1);
    expect(getNestedValue(simpleObject, 'name')).toBe('Alice');
    expect(getNestedValue(simpleObject, 'active')).toBe(true);
  });

  it('accesses nested keys with dot notation', () => {
    expect(getNestedValue(nestedObject, 'user.name')).toBe('Alice');
    expect(getNestedValue(nestedObject, 'user.email')).toBe(
      'alice@example.com',
    );
  });

  it('accesses deeply nested keys', () => {
    expect(getNestedValue(deeplyNestedObject, 'level1.level2.level3.value')).toBe(
      'deep',
    );
  });

  it('returns undefined for non-existent top-level key', () => {
    expect(getNestedValue(simpleObject, 'missing')).toBeUndefined();
  });

  it('returns undefined for non-existent nested key', () => {
    expect(getNestedValue(nestedObject, 'user.missing')).toBeUndefined();
    expect(getNestedValue(nestedObject, 'missing.name')).toBeUndefined();
  });

  it('returns undefined when traversing through null', () => {
    expect(getNestedValue(nullValuesObject, 'name.something')).toBeUndefined();
  });

  it('returns undefined when traversing through undefined', () => {
    expect(getNestedValue({}, 'a.b.c')).toBeUndefined();
  });

  it('returns null values (does not confuse null with missing)', () => {
    expect(getNestedValue(nullValuesObject, 'name')).toBeNull();
    expect(getNestedValue(nullValuesObject, 'data')).toBeNull();
  });

  it('returns array values', () => {
    expect(getNestedValue(nestedObject, 'tags')).toEqual(['admin', 'user']);
  });

  it('accesses array by numeric index via dot notation', () => {
    expect(getNestedValue(nestedObject, 'tags.0')).toBe('admin');
    expect(getNestedValue(nestedObject, 'tags.1')).toBe('user');
  });

  it('returns entire object for intermediate keys', () => {
    expect(getNestedValue(nestedObject, 'user')).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('handles null root', () => {
    expect(getNestedValue(null, 'key')).toBeUndefined();
  });

  it('handles undefined root', () => {
    expect(getNestedValue(undefined, 'key')).toBeUndefined();
  });
});

// ============================================================
// decodeUriStrings
// ============================================================

describe('decodeUriStrings', () => {
  // --- Simple encoded strings ---

  it('decodes %20 to space', () => {
    expect(decodeUriStrings('hello%20world')).toBe('hello world');
  });

  it('decodes %3A to colon', () => {
    expect(decodeUriStrings('key%3Avalue')).toBe('key:value');
  });

  it('decodes %2F to forward slash', () => {
    expect(decodeUriStrings('path%2Fto%2Ffile')).toBe('path/to/file');
  });

  it('decodes a full URL', () => {
    expect(decodeUriStrings('https%3A%2F%2Fexample.com')).toBe('https://example.com');
  });

  it('decodes complex URL with query params', () => {
    expect(decodeUriStrings('https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world')).toBe(
      'https://example.com/search?q=hello world',
    );
  });

  // --- Nested objects ---

  it('recursively decodes all string values in nested objects', () => {
    const input = {
      url: 'https%3A%2F%2Fexample.com',
      nested: {
        path: 'a%2Fb%2Fc',
        deep: {
          value: 'hello%20world',
        },
      },
    };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.url).toBe('https://example.com');
    expect((result.nested as Record<string, unknown>).path).toBe('a/b/c');
    expect(
      ((result.nested as Record<string, unknown>).deep as Record<string, unknown>).value,
    ).toBe('hello world');
  });

  it('preserves all keys in nested objects (data parity)', () => {
    const input = {
      url: 'https%3A%2F%2Fexample.com',
      count: 42,
      nested: { path: 'a%2Fb', flag: true },
    };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(Object.keys(input).sort());
    const nestedResult = result.nested as Record<string, unknown>;
    const nestedInput = input.nested as Record<string, unknown>;
    expect(Object.keys(nestedResult).sort()).toEqual(Object.keys(nestedInput).sort());
  });

  // --- Arrays ---

  it('decodes strings in arrays', () => {
    const input = ['hello%20world', 'key%3Avalue', 'path%2Fto'];
    const result = decodeUriStrings(input) as string[];
    expect(result).toEqual(['hello world', 'key:value', 'path/to']);
  });

  it('decodes strings in arrays within objects', () => {
    const input = {
      urls: ['https%3A%2F%2Fa.com', 'https%3A%2F%2Fb.com'],
      id: 1,
    };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.urls).toEqual(['https://a.com', 'https://b.com']);
    expect(result.id).toBe(1);
  });

  it('handles arrays of mixed types', () => {
    const input = ['hello%20world', 42, true, null, { key: 'val%3Aue' }];
    const result = decodeUriStrings(input) as unknown[];
    expect(result[0]).toBe('hello world');
    expect(result[1]).toBe(42);
    expect(result[2]).toBe(true);
    expect(result[3]).toBeNull();
    expect((result[4] as Record<string, unknown>).key).toBe('val:ue');
  });

  // --- Non-string values unchanged ---

  it('passes numbers through unchanged', () => {
    expect(decodeUriStrings(42)).toBe(42);
    expect(decodeUriStrings(0)).toBe(0);
    expect(decodeUriStrings(-5.5)).toBe(-5.5);
  });

  it('passes booleans through unchanged', () => {
    expect(decodeUriStrings(true)).toBe(true);
    expect(decodeUriStrings(false)).toBe(false);
  });

  it('passes null through unchanged', () => {
    expect(decodeUriStrings(null)).toBeNull();
  });

  it('passes undefined through unchanged', () => {
    expect(decodeUriStrings(undefined)).toBeUndefined();
  });

  it('preserves non-string values in objects', () => {
    const input = { count: 42, active: true, name: null, score: 0 };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.name).toBeNull();
    expect(result.score).toBe(0);
  });

  // --- Invalid sequences ---

  it('leaves invalid %ZZ sequence as-is', () => {
    expect(decodeUriStrings('%ZZ')).toBe('%ZZ');
  });

  it('leaves lone % as-is', () => {
    expect(decodeUriStrings('%')).toBe('%');
  });

  it('leaves incomplete %2 as-is', () => {
    expect(decodeUriStrings('%2')).toBe('%2');
  });

  it('does not throw on invalid sequences in nested objects', () => {
    const input = { bad: '%ZZ', nested: { also_bad: '%' } };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.bad).toBe('%ZZ');
    expect((result.nested as Record<string, unknown>).also_bad).toBe('%');
  });

  // --- Already decoded strings ---

  it('returns already decoded strings unchanged', () => {
    expect(decodeUriStrings('hello world')).toBe('hello world');
    expect(decodeUriStrings('https://example.com')).toBe('https://example.com');
  });

  it('handles empty string', () => {
    expect(decodeUriStrings('')).toBe('');
  });

  // --- Data parity ---

  it('preserves all keys and non-string values identical', () => {
    const input = {
      id: 1,
      name: 'Alice%20Smith',
      active: true,
      score: null,
      tags: ['admin', 'user%2Fstaff'],
      metadata: { role: 'admin%3Asuper', count: 5 },
    };
    const result = decodeUriStrings(input) as Record<string, unknown>;

    // All keys preserved
    expect(Object.keys(result).sort()).toEqual(Object.keys(input).sort());

    // Non-string values identical
    expect(result.id).toBe(input.id);
    expect(result.active).toBe(input.active);
    expect(result.score).toBe(input.score);
    expect((result.metadata as Record<string, unknown>).count).toBe(input.metadata.count);

    // String values decoded
    expect(result.name).toBe('Alice Smith');
    expect((result.tags as string[])[1]).toBe('user/staff');
    expect((result.metadata as Record<string, unknown>).role).toBe('admin:super');
  });

  it('handles empty object', () => {
    expect(decodeUriStrings({})).toEqual({});
  });

  it('handles empty array', () => {
    expect(decodeUriStrings([])).toEqual([]);
  });

  // --- Embedded JSON parsing ---

  it('parses embedded JSON object string into object', () => {
    const input = { filter: '{"customerId":8109}' };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.filter).toEqual({ customerId: 8109 });
    expect(typeof result.filter).toBe('object');
  });

  it('parses embedded JSON array string into array', () => {
    const input = { ids: '[1,2,3]' };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.ids).toEqual([1, 2, 3]);
    expect(Array.isArray(result.ids)).toBe(true);
  });

  it('recursively parses nested embedded JSON', () => {
    // A string that is JSON containing another string that is JSON
    const inner = JSON.stringify({ deep: true });
    const outer = JSON.stringify({ nested: inner });
    const input = { data: outer };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    const data = result.data as Record<string, unknown>;
    expect(data.nested).toEqual({ deep: true });
  });

  it('decodes URL-encoded embedded JSON (combo)', () => {
    // %7B%22key%22%3A%22value%22%7D → {"key":"value"} → { key: "value" }
    const input = '%7B%22key%22%3A%22value%22%7D';
    const result = decodeUriStrings(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('leaves non-JSON strings as strings', () => {
    expect(decodeUriStrings('hello world')).toBe('hello world');
    expect(decodeUriStrings('just a regular string')).toBe('just a regular string');
    expect(decodeUriStrings('123abc')).toBe('123abc');
  });

  it('leaves invalid JSON-looking strings as strings', () => {
    expect(decodeUriStrings('{"broken"')).toBe('{"broken"');
    expect(decodeUriStrings('{not json}')).toBe('{not json}');
    expect(decodeUriStrings('[incomplete')).toBe('[incomplete');
  });

  it('parses embedded JSON with nested arrays and objects', () => {
    const filter = {
      include: [{ model: 'User', where: { active: true } }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    };
    const input = { 'query.filter': JSON.stringify(filter) };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    const parsed = result['query.filter'] as Record<string, unknown>;

    expect(parsed).toEqual(filter);
    expect(Array.isArray(parsed.include)).toBe(true);
    expect(Array.isArray(parsed.order)).toBe(true);
    expect(parsed.limit).toBe(10);

    const include = (parsed.include as Record<string, unknown>[])[0];
    expect(include.model).toBe('User');
    expect((include.where as Record<string, unknown>).active).toBe(true);
  });

  it('handles real-world NDJSON log with Sequelize filter (data parity)', () => {
    const complexFilter = {
      include: [
        {
          model: 'Customer',
          as: 'customer',
          where: { status: 'active', type: 'enterprise' },
          required: true,
        },
      ],
      where: { customerId: 8109, deletedAt: null },
      order: [['createdAt', 'DESC']],
      limit: 25,
      offset: 0,
    };
    const logLine = {
      timestamp: '2026-02-26T10:00:00Z',
      level: 'info',
      'query.filter': JSON.stringify(complexFilter),
      'query.page': '1',
      userId: 42,
      success: true,
    };
    const result = decodeUriStrings(logLine) as Record<string, unknown>;

    // Non-string values preserved
    expect(result.userId).toBe(42);
    expect(result.success).toBe(true);

    // Plain strings stay as strings
    expect(result.timestamp).toBe('2026-02-26T10:00:00Z');
    expect(result.level).toBe('info');
    expect(result['query.page']).toBe('1');

    // Embedded JSON parsed into object
    const parsed = result['query.filter'] as Record<string, unknown>;
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();

    // Deep structure intact
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(0);
    expect((parsed.where as Record<string, unknown>).customerId).toBe(8109);
    expect((parsed.where as Record<string, unknown>).deletedAt).toBeNull();

    const include = (parsed.include as Record<string, unknown>[])[0];
    expect(include.model).toBe('Customer');
    expect(include.as).toBe('customer');
    expect(include.required).toBe(true);
    expect((include.where as Record<string, unknown>).status).toBe('active');
    expect((include.where as Record<string, unknown>).type).toBe('enterprise');

    const order = parsed.order as string[][];
    expect(order[0]).toEqual(['createdAt', 'DESC']);

    // All top-level keys preserved
    expect(Object.keys(result).sort()).toEqual(Object.keys(logLine).sort());
  });

  it('URL-encoded embedded JSON with nested structures', () => {
    // URL-encode a JSON string: {"ids":[1,2],"name":"test"}
    const jsonStr = '{"ids":[1,2],"name":"test"}';
    const encoded = encodeURIComponent(jsonStr);
    const result = decodeUriStrings(encoded);
    expect(result).toEqual({ ids: [1, 2], name: 'test' });
  });

  // --- maxDepth guard ---

  it('respects maxDepth to prevent runaway recursion', () => {
    // Create deeply nested embedded JSON (each level is a string that parses to an object)
    let value: string = '{"leaf":true}';
    for (let i = 0; i < 15; i++) {
      value = JSON.stringify({ nested: value });
    }

    // With default maxDepth=10, recursion stops before fully unwinding
    const result = decodeUriStrings(value);
    expect(result).toBeDefined();
    // Should not throw even with deep nesting
  });

  it('stops parsing at maxDepth=1', () => {
    const inner = JSON.stringify({ deep: true });
    const outer = JSON.stringify({ data: inner });
    // With maxDepth=1, the outer string is parsed but inner string is not recursed into
    const result = decodeUriStrings(outer, 1) as Record<string, unknown>;
    // Outer was parsed into object
    expect(typeof result).toBe('object');
    // But inner stays as a string since we ran out of depth
    expect(typeof result.data).toBe('string');
  });

  it('returns input unchanged at maxDepth=0', () => {
    const input = '{"key":"value"}';
    expect(decodeUriStrings(input, 0)).toBe(input);
  });

  // --- Embedded JSON data parity ---

  it('embedded JSON preserves all keys and values', () => {
    const embedded = { a: 1, b: 'hello', c: [1, 2], d: null, e: true };
    const input = { payload: JSON.stringify(embedded) };
    const result = decodeUriStrings(input) as Record<string, unknown>;
    expect(result.payload).toEqual(embedded);
    const parsed = result.payload as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(embedded).sort());
    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe('hello');
    expect(parsed.c).toEqual([1, 2]);
    expect(parsed.d).toBeNull();
    expect(parsed.e).toBe(true);
  });
});

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('escapes a full XSS payload', () => {
    const input = '<script>alert("xss")</script>';
    const result = escapeHtml(input);
    expect(result).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('handles all special chars from fixture', () => {
    const html = escapeHtml(specialCharsObject.html);
    expect(html).not.toContain('<script>');
    const amp = escapeHtml(specialCharsObject.ampersand);
    expect(amp).toBe('a &amp; b');
    const quotes = escapeHtml(specialCharsObject.quotes);
    expect(quotes).toBe('she said &quot;hello&quot;');
    const single = escapeHtml(specialCharsObject.singleQuote);
    expect(single).toBe('it&#039;s fine');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns string unchanged when no special characters', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles multiple occurrences of same character', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
  });
});
