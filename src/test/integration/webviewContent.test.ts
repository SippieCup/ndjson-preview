import { describe, it, expect } from 'vitest';
import { getWebviewContent } from '../../webview/webviewContent';
import type { WebviewContentOptions } from '../../types';
import { escapeJsonForHtml } from '../../utils/htmlUtils';
import { simpleObject, nestedObject, specialCharsObject } from '../fixtures/sampleData';

/**
 * Helper to generate webview HTML with sensible defaults.
 */
function renderHtml(overrides: Partial<WebviewContentOptions> = {}): string {
  const defaults: WebviewContentOptions = {
    json: simpleObject,
    lineNumber: 1,
    isError: false,
    reorderEnabled: false,
    wordWrapEnabled: false,
    uriDecodeEnabled: false,
    customOrder: [],
    filters: [],
    cssUri: 'https://example.com/pretty-print-json.css',
    jsUri: 'https://example.com/pretty-print-json.min.js',
  };
  return getWebviewContent({ ...defaults, ...overrides });
}

// ============================================================
// HTML structure & correctness
// ============================================================

describe('webview HTML structure', () => {
  it('generates valid HTML document', () => {
    const html = renderHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });

  it('displays the line number', () => {
    const html = renderHtml({ lineNumber: 42 });
    expect(html).toContain('Line 42');
  });

  it('includes JSON data in a script element for rendering', () => {
    const html = renderHtml({ json: { hello: 'world' } });
    expect(html).toContain('id="json-data"');
    expect(html).toContain('type="application/json"');
    // The JSON data is escaped via escapeJsonForHtml (only < → \u003c)
    const escaped = escapeJsonForHtml(JSON.stringify({ hello: 'world' }));
    expect(html).toContain(escaped);
  });

  it('includes json-container for JSON output', () => {
    const html = renderHtml();
    expect(html).toContain('class="json-container"');
  });

  it('includes the external CSS and JS URIs', () => {
    const html = renderHtml({
      cssUri: 'vscode-resource://css/style.css',
      jsUri: 'vscode-resource://js/script.js',
    });
    expect(html).toContain('href="vscode-resource://css/style.css"');
    expect(html).toContain('src="vscode-resource://js/script.js"');
  });

  it('includes nested JSON data (escaped) in script element', () => {
    const html = renderHtml({ json: nestedObject });
    const escaped = escapeJsonForHtml(JSON.stringify(nestedObject));
    expect(html).toContain(escaped);
  });

  it('JSON data in script element round-trips correctly', () => {
    const data = { id: 1, name: 'test', nested: { deep: true } };
    const html = renderHtml({ json: data });
    // Extract json-data script content via regex
    const match = html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    // escapeJsonForHtml only escapes < to \u003c, which JSON.parse handles natively
    expect(JSON.parse(match![1]!)).toEqual(data);
  });
});

// ============================================================
// Error state
// ============================================================

describe('webview error state', () => {
  it('renders error div when isError is true', () => {
    const html = renderHtml({
      json: 'Something went wrong',
      isError: true,
    });
    expect(html).toContain('class="error"');
    expect(html).toContain('Something went wrong');
  });

  it('escapes HTML in error messages', () => {
    const html = renderHtml({
      json: '<script>alert("xss")</script>',
      isError: true,
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('does not include json-data script element when in error state', () => {
    const html = renderHtml({
      json: 'Error message',
      isError: true,
    });
    expect(html).not.toContain('id="json-data"');
  });

  it('does not include JSON rendering script when in error state', () => {
    const html = renderHtml({
      json: 'Error message',
      isError: true,
    });
    expect(html).not.toContain('prettyPrintJson.toHtml');
  });

  it('includes JSON rendering script when NOT in error state', () => {
    const html = renderHtml({ isError: false });
    expect(html).toContain('prettyPrintJson.toHtml');
  });
});

// ============================================================
// VS Code theme variables (no hardcoded colors)
// ============================================================

describe('webview theming', () => {
  it('uses VS Code CSS variables for body background', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-editor-background)');
  });

  it('uses VS Code CSS variables for body foreground', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-editor-foreground)');
  });

  it('uses VS Code CSS variables for description foreground', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-descriptionForeground)');
  });

  it('uses VS Code CSS variables for panel border', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-panel-border)');
  });

  it('uses VS Code CSS variables for input styling', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-input-background)');
    expect(html).toContain('var(--vscode-input-foreground)');
    expect(html).toContain('var(--vscode-input-border)');
  });

  it('uses VS Code CSS variables for button styling', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-button-background)');
    expect(html).toContain('var(--vscode-button-foreground)');
  });

  it('uses VS Code CSS variables for error styling', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-errorForeground)');
    expect(html).toContain('var(--vscode-inputValidation-errorBackground)');
    expect(html).toContain('var(--vscode-inputValidation-errorBorder)');
  });

  it('uses VS Code theme variables for JSON syntax colors', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-debugTokenExpression-name');
    expect(html).toContain('var(--vscode-debugTokenExpression-string');
    expect(html).toContain('var(--vscode-debugTokenExpression-number');
    expect(html).toContain('var(--vscode-debugTokenExpression-boolean');
  });

  it('uses transparent background for json-container', () => {
    const html = renderHtml();
    expect(html).toContain('background-color: transparent !important');
  });

  it('does NOT contain hardcoded white background colors', () => {
    const html = renderHtml();
    // Allow "white-space" as a CSS property but reject "white" as a color value
    const withoutWhiteSpace = html.replace(/white-space/g, '');
    expect(withoutWhiteSpace).not.toMatch(/:\s*white\b/i);
    expect(withoutWhiteSpace).not.toMatch(/:\s*#fff\b/i);
    expect(withoutWhiteSpace).not.toMatch(/:\s*#ffffff\b/i);
    expect(html).not.toMatch(/background-color:\s*rgb\(255,\s*255,\s*255\)/i);
  });

  it('does NOT contain hardcoded black background colors', () => {
    const html = renderHtml();
    expect(html).not.toMatch(/background(?:-color)?:\s*black\b/i);
    expect(html).not.toMatch(/background(?:-color)?:\s*#000(?:000)?\b/i);
    expect(html).not.toMatch(/background(?:-color)?:\s*rgb\(0,\s*0,\s*0\)/i);
  });

  it('overrides library alternating row backgrounds to transparent', () => {
    const html = renderHtml();
    expect(html).toContain('ol.json-lines > li:nth-child(odd)');
    expect(html).toContain('ol.json-lines > li:nth-child(even)');
  });

  it('uses VS Code theme variable for link colors', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-textLink-foreground)');
  });
});

// ============================================================
// Reorder toggle state
// ============================================================

describe('webview reorder toggle', () => {
  it('shows checkmark when reorderEnabled is true', () => {
    const html = renderHtml({ reorderEnabled: true });
    // The dropdown-check span for reorder should contain a checkmark (&#10003;)
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('shows empty check when reorderEnabled is false', () => {
    const html = renderHtml({ reorderEnabled: false });
    // The dropdown-check span for reorder should be empty
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check"><\/span>/);
  });
});

// ============================================================
// Custom order UI
// ============================================================

describe('webview custom order', () => {
  it('shows custom order count when orders exist', () => {
    const html = renderHtml({ customOrder: ['id', 'name', 'status'] });
    expect(html).toContain('Custom Order (3)');
  });

  it('shows no count when custom order is empty', () => {
    const html = renderHtml({ customOrder: [] });
    expect(html).toMatch(/Custom Order(?!\s*\()/);
  });

  it('populates textarea with custom order keys', () => {
    const html = renderHtml({ customOrder: ['id', 'name'] });
    expect(html).toContain('id\nname');
  });

  it('shows active class on button when custom order set', () => {
    const html = renderHtml({ customOrder: ['id'] });
    expect(html).toContain('custom-order-btn active');
  });
});

// ============================================================
// Filter UI
// ============================================================

describe('webview filters', () => {
  it('shows filter count when filters exist', () => {
    const html = renderHtml({
      filters: [
        { key: 'status', value: 'active' },
        { key: 'role', value: 'admin' },
      ],
    });
    expect(html).toContain('Filter (2)');
  });

  it('shows no count when filters are empty', () => {
    const html = renderHtml({ filters: [] });
    expect(html).toMatch(/Filter(?!\s*\()/);
  });

  it('renders filter tags with escaped content', () => {
    const html = renderHtml({
      filters: [{ key: 'user.name', value: '<Alice>' }],
    });
    expect(html).toContain('user.name');
    expect(html).toContain('&lt;Alice&gt;');
    // The raw <Alice> should not appear as an HTML tag in filter tags
    // (it will appear in the json-data script though, so check specifically in filter area)
    expect(html).toMatch(/filter-tag[\s\S]*?&lt;Alice&gt;/);
  });

  it('shows active class on filter button when filters set', () => {
    const html = renderHtml({
      filters: [{ key: 'a', value: 'b' }],
    });
    expect(html).toMatch(/custom-order-btn active.*id="filter-btn"/s);
  });

  it('serializes filters into JavaScript', () => {
    const filters = [{ key: 'status', value: 'active' }];
    const html = renderHtml({ filters });
    expect(html).toContain(JSON.stringify(filters));
  });
});

// ============================================================
// JSON data fidelity (data round-trip)
// ============================================================

describe('webview data fidelity', () => {
  it('json-data script element round-trips simple data', () => {
    const data = { id: 1, name: 'Alice', active: true };
    const html = renderHtml({ json: data });
    const match = html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const rawContent = match![1]!
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    expect(JSON.parse(rawContent)).toEqual(data);
  });

  it('json-data script element round-trips nested data', () => {
    const data = { id: 1, nested: { deep: true }, arr: [1, 2, 3] };
    const html = renderHtml({ json: data });
    const match = html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const rawContent = match![1]!
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    expect(JSON.parse(rawContent)).toEqual(data);
  });

  it('json-data script element handles special characters', () => {
    const html = renderHtml({ json: specialCharsObject });
    const match = html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const rawContent = match![1]!
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    expect(JSON.parse(rawContent)).toEqual(specialCharsObject);
  });

  it('handles null JSON input in error mode', () => {
    const html = renderHtml({ json: null, isError: true });
    expect(html).toContain('null');
  });

  it('handles large nested objects', () => {
    const largeObj: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      largeObj[`key${i}`] = { value: i, nested: { deep: `value${i}` } };
    }
    const html = renderHtml({ json: largeObj });
    const match = html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const rawContent = match![1]!
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    expect(JSON.parse(rawContent)).toEqual(largeObj);
  });
});

// ============================================================
// Word wrap toggle
// ============================================================

describe('webview word wrap', () => {
  it('adds word-wrap class to json-container when wordWrapEnabled is true', () => {
    const html = renderHtml({ wordWrapEnabled: true });
    expect(html).toContain('class="json-container word-wrap"');
  });

  it('does not add word-wrap class when wordWrapEnabled is false', () => {
    const html = renderHtml({ wordWrapEnabled: false });
    // Should have json-container without word-wrap
    expect(html).toContain('class="json-container"');
    expect(html).not.toContain('class="json-container word-wrap"');
  });

  it('includes pre-wrap CSS rule for word-wrap class', () => {
    const html = renderHtml();
    expect(html).toContain('.json-container.word-wrap');
    expect(html).toContain('white-space: pre-wrap');
  });

  it('uses white-space: pre as default for json-container', () => {
    const html = renderHtml();
    // The base .json-container style should use "pre"
    expect(html).toMatch(/\.json-container\s*\{[^}]*white-space:\s*pre\s*;/);
  });

  it('includes overflow-wrap rule for word-wrap class', () => {
    const html = renderHtml();
    expect(html).toContain('overflow-wrap: break-word');
  });
});

// ============================================================
// Hamburger menu
// ============================================================

describe('webview hamburger menu', () => {
  it('contains hamburger menu button with ☰ character', () => {
    const html = renderHtml();
    // &#9776; is the HTML entity for ☰
    expect(html).toContain('&#9776;');
    expect(html).toContain('id="hamburger-btn"');
  });

  it('contains dropdown menu element', () => {
    const html = renderHtml();
    expect(html).toContain('id="dropdown-menu"');
    expect(html).toContain('class="dropdown-menu"');
  });

  it('contains three menu items: Reorder Keys, Word Wrap, Decode Strings', () => {
    const html = renderHtml();
    expect(html).toContain('Reorder Keys');
    expect(html).toContain('Word Wrap');
    expect(html).toContain('Decode Strings');
  });

  it('contains menu item IDs for each toggle', () => {
    const html = renderHtml();
    expect(html).toContain('id="toggle-reorder"');
    expect(html).toContain('id="toggle-wordwrap"');
    expect(html).toContain('id="toggle-uridecode"');
  });

  it('contains data-command attributes for each toggle', () => {
    const html = renderHtml();
    expect(html).toContain('data-command="toggleReorder"');
    expect(html).toContain('data-command="toggleWordWrap"');
    expect(html).toContain('data-command="toggleUriDecode"');
  });

  // --- Checkmarks for Reorder Keys ---

  it('shows checkmark on Reorder Keys when reorderEnabled is true', () => {
    const html = renderHtml({ reorderEnabled: true });
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('shows no checkmark on Reorder Keys when reorderEnabled is false', () => {
    const html = renderHtml({ reorderEnabled: false });
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check"><\/span>/);
  });

  // --- Checkmarks for Word Wrap ---

  it('shows checkmark on Word Wrap when wordWrapEnabled is true', () => {
    const html = renderHtml({ wordWrapEnabled: true });
    expect(html).toMatch(/id="toggle-wordwrap"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('shows no checkmark on Word Wrap when wordWrapEnabled is false', () => {
    const html = renderHtml({ wordWrapEnabled: false });
    expect(html).toMatch(/id="toggle-wordwrap"[\s\S]*?dropdown-check"><\/span>/);
  });

  // --- Checkmarks for Decode Strings ---

  it('shows checkmark on Decode Strings when uriDecodeEnabled is true', () => {
    const html = renderHtml({ uriDecodeEnabled: true });
    expect(html).toMatch(/id="toggle-uridecode"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('shows no checkmark on Decode Strings when uriDecodeEnabled is false', () => {
    const html = renderHtml({ uriDecodeEnabled: false });
    expect(html).toMatch(/id="toggle-uridecode"[\s\S]*?dropdown-check"><\/span>/);
  });

  // --- Combined states ---

  it('shows checkmarks on all items when all are enabled', () => {
    const html = renderHtml({
      reorderEnabled: true,
      wordWrapEnabled: true,
      uriDecodeEnabled: true,
    });
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check">&#10003;/);
    expect(html).toMatch(/id="toggle-wordwrap"[\s\S]*?dropdown-check">&#10003;/);
    expect(html).toMatch(/id="toggle-uridecode"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('shows no checkmarks when all are disabled', () => {
    const html = renderHtml({
      reorderEnabled: false,
      wordWrapEnabled: false,
      uriDecodeEnabled: false,
    });
    expect(html).toMatch(/id="toggle-reorder"[\s\S]*?dropdown-check"><\/span>/);
    expect(html).toMatch(/id="toggle-wordwrap"[\s\S]*?dropdown-check"><\/span>/);
    expect(html).toMatch(/id="toggle-uridecode"[\s\S]*?dropdown-check"><\/span>/);
  });

  it('uses VS Code theme variables for dropdown styling', () => {
    const html = renderHtml();
    expect(html).toContain('var(--vscode-menu-background');
    expect(html).toContain('var(--vscode-menu-foreground');
  });
});
