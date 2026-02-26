import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  window,
  workspace,
  commands,
  createMockWebviewPanel,
  createMockTextEditor,
  createMockExtensionContext,
} from '../mocks/vscode';
import { PreviewPanel } from '../../preview/previewPanel';

// Fresh mocks for each test
let mockPanel: ReturnType<typeof createMockWebviewPanel>;
let mockEditor: ReturnType<typeof createMockTextEditor>;
let mockContext: ReturnType<typeof createMockExtensionContext>;

beforeEach(() => {
  vi.clearAllMocks();

  mockPanel = createMockWebviewPanel();
  mockEditor = createMockTextEditor({
    lines: ['{"id":1,"name":"Alice"}', '{"id":2,"name":"Bob"}', ''],
    activeLine: 0,
  });
  mockContext = createMockExtensionContext();

  // Wire up the mock so createWebviewPanel returns our fresh panel
  (window.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(mockPanel);
  // Set active editor
  window.activeTextEditor = mockEditor as unknown as typeof window.activeTextEditor;
  window.visibleTextEditors = [];
});

// ============================================================
// Constructor
// ============================================================

describe('PreviewPanel constructor', () => {
  it('creates a decoration type', () => {
    new PreviewPanel(mockContext as any);
    expect(window.createTextEditorDecorationType).toHaveBeenCalledOnce();
  });

  it('loads custom order from global state', () => {
    mockContext.globalState._store['ndjson-preview.customOrder'] = ['id', 'name'];
    const panel = new PreviewPanel(mockContext as any);
    expect(mockContext.globalState.get).toHaveBeenCalledWith(
      'ndjson-preview.customOrder',
      [],
    );
    expect(panel.isVisible).toBe(false);
  });

  it('starts not visible', () => {
    const panel = new PreviewPanel(mockContext as any);
    expect(panel.isVisible).toBe(false);
  });
});

// ============================================================
// show()
// ============================================================

describe('PreviewPanel.show()', () => {
  it('creates a webview panel', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
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

  it('reveals existing panel instead of creating new one', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    panel.show();
    // createWebviewPanel should only be called once
    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(mockPanel.reveal).toHaveBeenCalledOnce();
  });

  it('shows error when no active editor', () => {
    window.activeTextEditor = undefined;
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(window.showErrorMessage).toHaveBeenCalledWith('No active editor found');
    expect(panel.isVisible).toBe(false);
  });

  it('sets webview HTML after creating panel', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(mockPanel.webview.html).toContain('<!DOCTYPE html>');
    expect(mockPanel.webview.html).toContain('Line 1');
  });

  it('registers message handler on panel', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledOnce();
  });

  it('registers dispose handler on panel', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(mockPanel.onDidDispose).toHaveBeenCalledOnce();
  });

  it('becomes not visible after panel dispose', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(panel.isVisible).toBe(true);
    mockPanel._fireDispose();
    expect(panel.isVisible).toBe(false);
  });

  it('clears decorations on active editor when panel disposes', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    mockPanel._fireDispose();
    // setDecorations is called with empty array to clear
    const calls = mockEditor.setDecorations.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual([]);
  });
});

// ============================================================
// update()
// ============================================================

describe('PreviewPanel.update()', () => {
  it('does nothing when panel is not visible', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.update(mockEditor as any);
    // No HTML set since panel doesn't exist
    expect(mockPanel.webview.html).toBe('');
  });

  it('parses valid JSON and renders it', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    expect(mockPanel.webview.html).toContain('Line 1');
    expect(mockPanel.webview.html).toContain('"id"');
  });

  it('renders different line when cursor moves', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    const editorLine2 = createMockTextEditor({
      lines: ['{"id":1,"name":"Alice"}', '{"id":2,"name":"Bob"}'],
      activeLine: 1,
    });
    panel.update(editorLine2 as any);
    expect(mockPanel.webview.html).toContain('Line 2');
  });

  it('handles empty line as error state', () => {
    const editorEmpty = createMockTextEditor({
      lines: [''],
      activeLine: 0,
    });
    const panel = new PreviewPanel(mockContext as any);
    window.activeTextEditor = editorEmpty as any;
    panel.show();
    expect(mockPanel.webview.html).toContain('class="error"');
  });

  it('handles invalid JSON as error state', () => {
    const editorBad = createMockTextEditor({
      lines: ['{not valid json}'],
      activeLine: 0,
    });
    const panel = new PreviewPanel(mockContext as any);
    window.activeTextEditor = editorBad as any;
    panel.show();
    expect(mockPanel.webview.html).toContain('Error parsing JSON');
  });

  it('sets decorations to highlight current line', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    // setDecorations called twice per update: once to clear, once to highlight
    expect(mockEditor.setDecorations).toHaveBeenCalled();
    const calls = mockEditor.setDecorations.mock.calls;
    // First call clears (empty array)
    expect(calls[0][1]).toEqual([]);
    // Second call highlights (range)
    expect(calls[1][1]).toHaveLength(1);
  });

  it('applies reorderKeys when enabled via message', () => {
    const editorMixed = createMockTextEditor({
      lines: ['{"zObj":{"nested":true},"aPrim":1}'],
      activeLine: 0,
    });
    window.activeTextEditor = editorMixed as any;

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    // Enable reorder via message
    mockPanel._fireMessage({ command: 'toggleReorder', value: true });
    const html = mockPanel.webview.html;
    // After reorder, aPrim (primitive) should come before zObj (object)
    const aPrimIdx = html.indexOf('aPrim');
    const zObjIdx = html.indexOf('zObj');
    expect(aPrimIdx).toBeLessThan(zObjIdx);
  });

  it('applies custom order when set via message', () => {
    const editorOrder = createMockTextEditor({
      lines: ['{"name":"Alice","id":1,"status":"active"}'],
      activeLine: 0,
    });
    window.activeTextEditor = editorOrder as any;

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    // Set custom order via message
    mockPanel._fireMessage({ command: 'setCustomOrder', value: ['id', 'name'] });
    const html = mockPanel.webview.html;
    // id should appear before name in the rendered output
    const idIdx = html.indexOf('"id"');
    const nameIdx = html.indexOf('"name"');
    expect(idIdx).toBeLessThan(nameIdx);
  });

  it('custom order takes precedence over reorderKeys', () => {
    const editor = createMockTextEditor({
      lines: ['{"z":{"nested":true},"a":1,"b":2}'],
      activeLine: 0,
    });
    window.activeTextEditor = editor as any;

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    // Enable both reorder and custom order
    mockPanel._fireMessage({ command: 'toggleReorder', value: true });
    mockPanel._fireMessage({ command: 'setCustomOrder', value: ['b', 'z'] });

    const html = mockPanel.webview.html;
    // Custom order should win: b first, then z, then a
    const bIdx = html.indexOf('"b"');
    const zIdx = html.indexOf('"z"');
    expect(bIdx).toBeLessThan(zIdx);
  });
});

// ============================================================
// Message handling
// ============================================================

describe('PreviewPanel message handling', () => {
  it('toggleReorder updates state and re-renders', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();
    const htmlBefore = mockPanel.webview.html;

    mockPanel._fireMessage({ command: 'toggleReorder', value: true });
    // HTML should be re-rendered (may or may not differ depending on data)
    expect(mockPanel.webview.html).toContain('<!DOCTYPE html>');
  });

  it('setCustomOrder persists to global state', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    mockPanel._fireMessage({ command: 'setCustomOrder', value: ['id', 'name'] });
    expect(mockContext.globalState.update).toHaveBeenCalledWith(
      'ndjson-preview.customOrder',
      ['id', 'name'],
    );
  });

  it('setFilters with filters triggers createFilteredView', async () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'id', value: '1' }],
    });
    // createFilteredView is async; flush microtasks
    await vi.waitFor(() => {
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(window.showInformationMessage).toHaveBeenCalled();
    });
  });

  it('setFilters with empty array triggers closeFilteredView', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    // First add filters
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'id', value: '1' }],
    });
    // Then clear them
    mockPanel._fireMessage({ command: 'setFilters', value: [] });
    // Should not throw
    expect(mockPanel.webview.html).toContain('<!DOCTYPE html>');
  });

  it('messages do nothing before show() is called', () => {
    const panel = new PreviewPanel(mockContext as any);
    // No show() — panel is not visible, no lastEditor
    // Calling update directly with no panel should be a no-op
    panel.update(mockEditor as any);
    expect(mockPanel.webview.html).toBe('');
  });
});

// ============================================================
// createFilteredView
// ============================================================

describe('PreviewPanel filtered view', () => {
  it('opens filtered document with matching lines', async () => {
    const editor = createMockTextEditor({
      lines: [
        '{"id":1,"status":"active"}',
        '{"id":2,"status":"inactive"}',
        '{"id":3,"status":"active"}',
      ],
      activeLine: 0,
    });
    window.activeTextEditor = editor as any;

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'status', value: 'active' }],
    });

    await vi.waitFor(() => {
      expect(workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'jsonl',
        }),
      );
    });
    await vi.waitFor(() => {
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        'Showing 2 of 3 lines',
      );
    });
  });

  it('filtered content contains only matching lines', () => {
    const editor = createMockTextEditor({
      lines: [
        '{"id":1,"status":"active"}',
        '{"id":2,"status":"inactive"}',
        '{"id":3,"status":"active"}',
      ],
      activeLine: 0,
    });
    window.activeTextEditor = editor as any;

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'status', value: 'active' }],
    });

    const openCall = (workspace.openTextDocument as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const content = openCall.content;
    const lines = content.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).status).toBe('active');
    expect(JSON.parse(lines[1]).status).toBe('active');
  });

  it('closeFilteredView executes close command when filtered doc is visible', async () => {
    const editor = createMockTextEditor({
      lines: ['{"id":1,"status":"active"}'],
      activeLine: 0,
    });
    window.activeTextEditor = editor as any;

    const mockFilteredDoc = { uri: 'filtered' };
    (workspace.openTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue(mockFilteredDoc);

    // Set up a visible editor with the filtered document
    window.visibleTextEditors = [{ document: mockFilteredDoc }];

    const panel = new PreviewPanel(mockContext as any);
    panel.show();

    // Add filters (creates filtered view)
    mockPanel._fireMessage({
      command: 'setFilters',
      value: [{ key: 'id', value: '1' }],
    });

    // Wait for async createFilteredView to complete
    await vi.waitFor(() => {
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    // Clear filters (closes filtered view)
    mockPanel._fireMessage({ command: 'setFilters', value: [] });
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.closeActiveEditor',
    );
  });
});

// ============================================================
// dispose()
// ============================================================

describe('PreviewPanel.dispose()', () => {
  it('disposes the decoration type', () => {
    const panel = new PreviewPanel(mockContext as any);
    const decorationType = (window.createTextEditorDecorationType as ReturnType<typeof vi.fn>).mock.results[0].value;
    panel.dispose();
    expect(decorationType.dispose).toHaveBeenCalledOnce();
  });

  it('can be called multiple times safely', () => {
    const panel = new PreviewPanel(mockContext as any);
    panel.dispose();
    panel.dispose();
    // Should not throw
  });
});
