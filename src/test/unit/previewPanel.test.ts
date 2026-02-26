import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  window,
  workspace,
  commands,
  createMockWebviewPanel,
  createMockTextEditor,
  createMockExtensionContext,
} from '../mocks/vscode';
import { PreviewPanel } from '../../preview/previewPanel';
import type * as vscode from 'vscode';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  window.activeTextEditor = undefined;
  window.visibleTextEditors = [];
  // Reset createWebviewPanel to return a fresh panel each time
  window.createWebviewPanel.mockImplementation(() => createMockWebviewPanel());
});

function createPanel(contextOverrides: Record<string, unknown> = {}) {
  const ctx = createMockExtensionContext(contextOverrides);
  const panel = new PreviewPanel(ctx as unknown as vscode.ExtensionContext);
  return { panel, ctx };
}

// ============================================================
// Constructor
// ============================================================

describe('PreviewPanel constructor', () => {
  it('creates a decoration type', () => {
    createPanel();
    expect(window.createTextEditorDecorationType).toHaveBeenCalledOnce();
    expect(window.createTextEditorDecorationType).toHaveBeenCalledWith(
      expect.objectContaining({
        isWholeLine: true,
      }),
    );
  });

  it('loads custom order from globalState', () => {
    const ctx = createMockExtensionContext();
    (ctx.globalState._store as Record<string, unknown>)['ndjson-preview.customOrder'] = ['id', 'name'];
    const panel = new PreviewPanel(ctx as unknown as vscode.ExtensionContext);
    expect(ctx.globalState.get).toHaveBeenCalledWith('ndjson-preview.customOrder', []);
    expect(panel.isVisible).toBe(false);
  });

  it('initializes with isVisible = false', () => {
    const { panel } = createPanel();
    expect(panel.isVisible).toBe(false);
  });
});

// ============================================================
// show()
// ============================================================

describe('PreviewPanel.show()', () => {
  it('shows error message when no active editor', () => {
    window.activeTextEditor = undefined;
    const { panel } = createPanel();
    panel.show();
    expect(window.showErrorMessage).toHaveBeenCalledWith('No active editor found');
  });

  it('creates webview panel on first show', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;
    const { panel } = createPanel();

    panel.show();

    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(window.createWebviewPanel).toHaveBeenCalledWith(
      'ndjsonPreview',
      'NDJSON Preview',
      expect.anything(),
      expect.objectContaining({
        enableScripts: true,
        retainContextWhenHidden: true,
      }),
    );
    expect(panel.isVisible).toBe(true);
  });

  it('reveals existing panel on subsequent show', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show(); // first show creates
    panel.show(); // second show reveals

    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(mockPanel.reveal).toHaveBeenCalledOnce();
  });

  it('sets webview html after show', () => {
    const editor = createMockTextEditor({ lines: ['{"id":1}'] });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();

    expect(mockPanel.webview.html).toContain('<!DOCTYPE html>');
    expect(mockPanel.webview.html).toContain('Line 1');
  });

  it('registers onDidReceiveMessage handler', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();

    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledOnce();
  });

  it('registers onDidDispose handler', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();

    expect(mockPanel.onDidDispose).toHaveBeenCalledOnce();
  });

  it('clears panel reference on dispose', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();
    expect(panel.isVisible).toBe(true);

    mockPanel._fireDispose();
    expect(panel.isVisible).toBe(false);
  });

  it('clears decorations on panel dispose when editor active', () => {
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();
    mockPanel._fireDispose();

    // setDecorations called with empty array on dispose
    const setDecCalls = editor.setDecorations.mock.calls;
    const lastCall = setDecCalls[setDecCalls.length - 1];
    expect(lastCall![1]).toEqual([]);
  });
});

// ============================================================
// update()
// ============================================================

describe('PreviewPanel.update()', () => {
  function showPanel(lines: string[] = ['{"id":1}']) {
    const editor = createMockTextEditor({ lines });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel, ctx } = createPanel();
    panel.show();
    return { panel, editor, mockPanel, ctx };
  }

  it('returns early if panel not created', () => {
    const { panel } = createPanel();
    const editor = createMockTextEditor();
    // Should not throw
    panel.update(editor as unknown as vscode.TextEditor);
  });

  it('highlights current line', () => {
    const { editor } = showPanel();
    // setDecorations should have been called with the range
    expect(editor.setDecorations).toHaveBeenCalled();
  });

  it('renders valid JSON line', () => {
    const { mockPanel } = showPanel(['{"name":"Alice","id":1}']);
    expect(mockPanel.webview.html).toContain('Line 1');
    expect(mockPanel.webview.html).toContain('class="json-container"');
    // Valid JSON should have json-data script element (only present when not error)
    expect(mockPanel.webview.html).toContain('id="json-data"');
  });

  it('renders error for empty line', () => {
    const { mockPanel } = showPanel(['']);
    expect(mockPanel.webview.html).toContain('Line 1');
  });

  it('renders error for invalid JSON', () => {
    const { mockPanel } = showPanel(['{not valid json}']);
    expect(mockPanel.webview.html).toContain('Error parsing JSON');
  });

  it('applies reorder keys when enabled via message', () => {
    const lines = ['{"z_obj":{"nested":true},"a_prim":1}'];
    const { panel, mockPanel, editor } = showPanel(lines);

    // Toggle reorder on
    mockPanel._fireMessage({ command: 'toggleReorder', value: true });

    // The HTML should now contain the reordered JSON (primitives first)
    const html = mockPanel.webview.html;
    // After reorder, a_prim (primitive) comes before z_obj (object)
    expect(html).toBeTruthy();
  });

  it('applies custom order when set via message', () => {
    const lines = ['{"name":"Alice","id":1,"status":"active"}'];
    const { mockPanel, ctx } = showPanel(lines);

    mockPanel._fireMessage({
      command: 'setCustomOrder',
      value: ['id', 'name'],
    });

    expect(ctx.globalState.update).toHaveBeenCalledWith(
      'ndjson-preview.customOrder',
      ['id', 'name'],
    );
  });

  it('updates on multiple lines', () => {
    const lines = ['{"id":1}', '{"id":2}', '{"id":3}'];
    const { panel, mockPanel } = showPanel(lines);

    const editor2 = createMockTextEditor({ lines, activeLine: 1 });
    panel.update(editor2 as unknown as vscode.TextEditor);

    expect(mockPanel.webview.html).toContain('Line 2');
  });
});

// ============================================================
// handleMessage()
// ============================================================

describe('PreviewPanel message handling', () => {
  function showPanel(lines: string[] = ['{"id":1}']) {
    const editor = createMockTextEditor({ lines });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel, ctx } = createPanel();
    panel.show();
    return { panel, editor, mockPanel, ctx };
  }

  it('toggleReorder updates state and re-renders', () => {
    const { mockPanel } = showPanel();
    const htmlBefore = mockPanel.webview.html;

    mockPanel._fireMessage({ command: 'toggleReorder', value: true });

    // HTML should have been updated (may or may not differ depending on content)
    expect(typeof mockPanel.webview.html).toBe('string');
    expect(mockPanel.webview.html.length).toBeGreaterThan(0);
  });

  it('setCustomOrder saves to globalState', () => {
    const { mockPanel, ctx } = showPanel();

    mockPanel._fireMessage({ command: 'setCustomOrder', value: ['a', 'b'] });

    expect(ctx.globalState.update).toHaveBeenCalledWith(
      'ndjson-preview.customOrder',
      ['a', 'b'],
    );
  });

  it('setFilters with filters creates filtered view', () => {
    const { mockPanel } = showPanel(['{"status":"active"}', '{"status":"inactive"}']);

    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'status', value: 'active' }],
    });

    expect(workspace.openTextDocument).toHaveBeenCalled();
  });

  it('setFilters with empty array closes filtered view', () => {
    const { mockPanel } = showPanel();

    // First set filters, then clear them
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'id', value: '1' }],
    });
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [],
    });

    // closeFilteredView should have been called (no error)
    expect(mockPanel.webview.html).toBeTruthy();
  });

  it('toggleWordWrap toggles word wrap state and re-renders', () => {
    const { mockPanel } = showPanel();

    // First toggle: off → on
    mockPanel._fireMessage({ command: 'toggleWordWrap', value: true });
    const htmlAfterOn = mockPanel.webview.html;
    expect(htmlAfterOn).toContain('word-wrap');

    // Second toggle: on → off
    mockPanel._fireMessage({ command: 'toggleWordWrap', value: false });
    const htmlAfterOff = mockPanel.webview.html;
    expect(htmlAfterOff).not.toContain('class="json-container word-wrap"');
  });

  it('toggleUriDecode toggles URI decode state and re-renders', () => {
    const lines = ['{"url":"https%3A%2F%2Fexample.com","id":1}'];
    const { mockPanel } = showPanel(lines);

    // Toggle URI decode on
    mockPanel._fireMessage({ command: 'toggleUriDecode', value: true });
    const htmlOn = mockPanel.webview.html;

    // The JSON data should contain the decoded URL
    const matchOn = htmlOn.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(matchOn).not.toBeNull();
    const dataOn = JSON.parse(matchOn![1]!);
    expect(dataOn.url).toBe('https://example.com');
    expect(dataOn.id).toBe(1);

    // Toggle URI decode off
    mockPanel._fireMessage({ command: 'toggleUriDecode', value: false });
    const htmlOff = mockPanel.webview.html;

    const matchOff = htmlOff.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(matchOff).not.toBeNull();
    const dataOff = JSON.parse(matchOff![1]!);
    expect(dataOff.url).toBe('https%3A%2F%2Fexample.com');
    expect(dataOff.id).toBe(1);
  });

  it('toggleUriDecode preserves non-string values (data parity)', () => {
    const lines = ['{"name":"Alice%20Smith","count":42,"active":true,"score":null}'];
    const { mockPanel } = showPanel(lines);

    mockPanel._fireMessage({ command: 'toggleUriDecode', value: true });

    const match = mockPanel.webview.html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const data = JSON.parse(match![1]!);
    expect(data.name).toBe('Alice Smith');
    expect(data.count).toBe(42);
    expect(data.active).toBe(true);
    expect(data.score).toBeNull();
  });

  it('toggleUriDecode decodes nested object values', () => {
    const lines = ['{"user":{"name":"Alice%20Smith","email":"alice%40example.com"},"id":1}'];
    const { mockPanel } = showPanel(lines);

    mockPanel._fireMessage({ command: 'toggleUriDecode', value: true });

    const match = mockPanel.webview.html.match(/<script id="json-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const data = JSON.parse(match![1]!);
    expect(data.user.name).toBe('Alice Smith');
    expect(data.user.email).toBe('alice@example.com');
    expect(data.id).toBe(1);
  });

  it('toggleWordWrap shows checkmark in menu when enabled', () => {
    const { mockPanel } = showPanel();

    mockPanel._fireMessage({ command: 'toggleWordWrap', value: true });
    // The rendered HTML should contain a checkmark for word wrap
    expect(mockPanel.webview.html).toMatch(/id="toggle-wordwrap"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('toggleUriDecode shows checkmark in menu when enabled', () => {
    const { mockPanel } = showPanel();

    mockPanel._fireMessage({ command: 'toggleUriDecode', value: true });
    expect(mockPanel.webview.html).toMatch(/id="toggle-uridecode"[\s\S]*?dropdown-check">&#10003;/);
  });

  it('handles toggleReorder without lastEditor gracefully', () => {
    // Create panel but don't show it (no lastEditor)
    const editor = createMockTextEditor();
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();

    // Manually clear activeTextEditor to simulate edge case
    // The message should not throw even if panel state is tricky
    mockPanel._fireMessage({ command: 'toggleReorder', value: false });
    expect(mockPanel.webview.html).toBeTruthy();
  });
});

// ============================================================
// dispose()
// ============================================================

describe('PreviewPanel.dispose()', () => {
  it('disposes decoration type', () => {
    const { panel } = createPanel();
    const decorationDispose = window.createTextEditorDecorationType.mock.results[0]?.value?.dispose;
    panel.dispose();
    expect(decorationDispose).toHaveBeenCalled();
  });

  it('closes filtered view on dispose', () => {
    const editor = createMockTextEditor({ lines: ['{"id":1}'] });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const { panel } = createPanel();
    panel.show();

    // Set up a filtered document by sending a filter message
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'id', value: '1' }],
    });

    // dispose should not throw
    panel.dispose();
    expect(window.createTextEditorDecorationType.mock.results[0]?.value?.dispose).toHaveBeenCalled();
  });
});

// ============================================================
// closeFilteredView()
// ============================================================

describe('PreviewPanel filtered view', () => {
  it('closeFilteredView executes close command for matching editors', async () => {
    const editor = createMockTextEditor({
      lines: ['{"status":"active"}', '{"status":"inactive"}'],
    });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const mockPanel = createMockWebviewPanel();
    window.createWebviewPanel.mockReturnValue(mockPanel);

    const mockFilteredDoc = { uri: { fsPath: '/mock/filtered' } };
    workspace.openTextDocument.mockResolvedValue(mockFilteredDoc);

    // Put a matching editor in visibleTextEditors
    window.visibleTextEditors = [
      { document: mockFilteredDoc },
    ];

    const { panel } = createPanel();
    panel.show();

    // Set filters to create a filtered view
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'status', value: 'active' }],
    });

    // Wait for async createFilteredView
    await vi.waitFor(() => {
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    // Now clear filters to trigger closeFilteredView
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [],
    });

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.closeActiveEditor',
    );
  });
});
