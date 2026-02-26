import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeJsonForHtml } from '../../utils/htmlUtils';
import { specialCharsObject } from '../fixtures/sampleData';

// ============================================================
// escapeHtml (canonical location in htmlUtils)
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
    expect(escapeHtml(specialCharsObject.html)).not.toContain('<script>');
    expect(escapeHtml(specialCharsObject.ampersand)).toBe('a &amp; b');
    expect(escapeHtml(specialCharsObject.quotes)).toBe('she said &quot;hello&quot;');
    expect(escapeHtml(specialCharsObject.singleQuote)).toBe('it&#039;s fine');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns string unchanged when no special characters', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles multiple occurrences', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
  });
});

// ============================================================
// escapeJsonForHtml
// ============================================================

describe('escapeJsonForHtml', () => {
  it('replaces < with unicode escape', () => {
    expect(escapeJsonForHtml('<')).toBe('\\u003c');
  });

  it('prevents </script> from appearing in output', () => {
    const input = '{"html":"</script>"}';
    const result = escapeJsonForHtml(input);
    expect(result).not.toContain('</script>');
    expect(result).toContain('\\u003c/script>');
  });

  it('preserves valid JSON parsing after escaping', () => {
    const obj = { html: '<b>bold</b>', script: '</script>' };
    const json = JSON.stringify(obj);
    const escaped = escapeJsonForHtml(json);
    // JSON.parse handles \u003c transparently
    expect(JSON.parse(escaped)).toEqual(obj);
  });

  it('does not alter strings without <', () => {
    const input = '{"name":"Alice","count":42}';
    expect(escapeJsonForHtml(input)).toBe(input);
  });

  it('handles multiple < characters', () => {
    const input = '<<<';
    const result = escapeJsonForHtml(input);
    expect(result).toBe('\\u003c\\u003c\\u003c');
    expect(result).not.toContain('<');
  });

  it('handles empty string', () => {
    expect(escapeJsonForHtml('')).toBe('');
  });

  it('round-trips complex JSON with HTML in values', () => {
    const obj = {
      content: '<div class="test">Hello & "world"</div>',
      nested: { tag: '<span>' },
    };
    const json = JSON.stringify(obj);
    const escaped = escapeJsonForHtml(json);
    expect(JSON.parse(escaped)).toEqual(obj);
  });
});
