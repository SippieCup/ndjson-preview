/**
 * Sample NDJSON data for testing.
 *
 * Each constant represents a realistic line from an NDJSON file.
 * Used across unit and integration tests.
 */

// --- Simple flat objects ---

export const simpleLine = '{"id":1,"name":"Alice","active":true}';

export const simpleObject = { id: 1, name: 'Alice', active: true };

export const numericLine = '{"count":42,"price":9.99,"negative":-5}';

export const numericObject = { count: 42, price: 9.99, negative: -5 };

// --- Nested objects ---

export const nestedLine =
  '{"id":1,"user":{"name":"Alice","email":"alice@example.com"},"tags":["admin","user"]}';

export const nestedObject = {
  id: 1,
  user: { name: 'Alice', email: 'alice@example.com' },
  tags: ['admin', 'user'],
};

export const deeplyNestedLine =
  '{"level1":{"level2":{"level3":{"value":"deep"}}}}';

export const deeplyNestedObject = {
  level1: { level2: { level3: { value: 'deep' } } },
};

// --- Edge cases ---

export const emptyObject = {};
export const emptyObjectLine = '{}';

export const nullValuesObject = { id: 1, name: null, data: null };
export const nullValuesLine = '{"id":1,"name":null,"data":null}';

export const arrayValuesObject = { items: [1, 2, 3], tags: ['a', 'b'] };
export const arrayValuesLine = '{"items":[1,2,3],"tags":["a","b"]}';

export const mixedTypesObject = {
  str: 'hello',
  num: 42,
  bool: true,
  nil: null,
  arr: [1, 'two'],
  obj: { nested: true },
};

export const specialCharsObject = {
  html: '<script>alert("xss")</script>',
  ampersand: 'a & b',
  quotes: 'she said "hello"',
  singleQuote: "it's fine",
};

// --- Multi-line NDJSON content ---

export const sampleNdjsonLines = [
  '{"id":1,"status":"active","user":{"name":"Alice","role":"admin"}}',
  '{"id":2,"status":"inactive","user":{"name":"Bob","role":"user"}}',
  '{"id":3,"status":"active","user":{"name":"Charlie","role":"user"}}',
  '{"id":4,"status":"active","user":{"name":"Diana","role":"admin"}}',
  '{"id":5,"status":"inactive","user":{"name":"Eve","role":"viewer"}}',
];

export const sampleNdjsonContent = sampleNdjsonLines.join('\n');

export const sampleNdjsonObjects = sampleNdjsonLines.map((l) => JSON.parse(l));

// --- Objects designed for reorder testing ---

export const reorderTestObject = {
  zeta: { nested: true },
  alpha: 1,
  beta: 'hello',
  gamma: [1, 2],
  delta: null,
  epsilon: { deep: { value: 42 } },
};

// After reorderJsonKeys: primitives first, then objects (preserving original relative order)
export const reorderExpected = {
  alpha: 1,
  beta: 'hello',
  delta: null,
  zeta: { nested: true },
  gamma: [1, 2],
  epsilon: { deep: { value: 42 } },
};

// --- Objects designed for custom order testing ---

export const customOrderTestObject = {
  name: 'Alice',
  id: 1,
  status: 'active',
  email: 'alice@example.com',
  role: 'admin',
};

// Custom order: ['id', 'name', 'email']
export const customOrderExpected = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  status: 'active',
  role: 'admin',
};
