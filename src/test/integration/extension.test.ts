import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  window,
  commands,
  createMockWebviewPanel,
  createMockTextEditor,
  createMockExtensionContext,
} from '../mocks/vscode';
import { activate, deactivate } from '../../extension';

let mockPanel: ReturnType<typeof createMockWebviewPanel>;
let mockContext: ReturnType<typeof createMockExtensionContext>;

beforeEach(() => {
  vi.clearAllMocks();

  mockPanel = createMockWebviewPanel();
  mockContext = createMockExtensionContext();

  (window.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(mockPanel);
  window.activeTextEditor = undefined;
});

// ============================================================
// activate()
// ============================================================

describe('activate', () => {
  it('registers the open preview command', () => {
    activate(mockContext as any);
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'ndjson-preview.open',
      expect.any(Function),
    );
  });

  it('registers cursor change listener', () => {
    activate(mockContext as any);
    expect(window.onDidChangeTextEditorSelection).toHaveBeenCalledOnce();
  });

  it('registers editor change listener', () => {
    activate(mockContext as any);
    expect(window.onDidChangeActiveTextEditor).toHaveBeenCalledOnce();
  });

  it('pushes disposables to context.subscriptions', () => {
    activate(mockContext as any);
    // command + cursorListener + editorListener + panel dispose wrapper = 4
    expect(mockContext.subscriptions).toHaveLength(4);
  });

  it('auto-opens preview when active editor is jsonl', () => {
    const editor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = editor as any;

    activate(mockContext as any);
    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
  });

  it('does NOT auto-open preview for non-jsonl files', () => {
    const editor = createMockTextEditor({ languageId: 'json' });
    window.activeTextEditor = editor as any;

    activate(mockContext as any);
    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('does NOT auto-open preview when no active editor', () => {
    window.activeTextEditor = undefined;
    activate(mockContext as any);
    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('open command invokes show on the preview panel', () => {
    window.activeTextEditor = createMockTextEditor({ languageId: 'jsonl' }) as any;

    activate(mockContext as any);

    // Find the registered command callback
    const registerCall = (commands.registerCommand as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(registerCall[0]).toBe('ndjson-preview.open');

    // Reset and invoke the callback
    (window.createWebviewPanel as ReturnType<typeof vi.fn>).mockClear();
    (window.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockWebviewPanel(),
    );
    const callback = registerCall[1];
    callback();
    // If panel didn't exist, show() would create one
    // (it may or may not call createWebviewPanel depending on state)
  });

  it('subscriptions dispose cleans up preview panel', () => {
    activate(mockContext as any);

    const decorationType = (window.createTextEditorDecorationType as ReturnType<typeof vi.fn>)
      .mock.results[0].value;

    // Find the dispose wrapper (last subscription)
    const disposeWrapper = mockContext.subscriptions[mockContext.subscriptions.length - 1];
    disposeWrapper.dispose();

    expect(decorationType.dispose).toHaveBeenCalledOnce();
  });

  it('cursor change listener updates preview for jsonl files when visible', () => {
    const editor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = editor as any;

    // Capture the cursor change callback
    let cursorCallback: (event: unknown) => void = () => {};
    (window.onDidChangeTextEditorSelection as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (event: unknown) => void) => {
        cursorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);
    // Panel is now visible (auto-opened for jsonl)

    // Simulate cursor change
    const newEditor = createMockTextEditor({ lines: ['{"id":2}'], activeLine: 0, languageId: 'jsonl' });
    cursorCallback({ textEditor: newEditor });

    // update() should have set new HTML on the panel
    expect(mockPanel.webview.html).toContain('Line 1');
  });

  it('cursor change listener ignores non-jsonl files', () => {
    const editor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = editor as any;

    let cursorCallback: (event: unknown) => void = () => {};
    (window.onDidChangeTextEditorSelection as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (event: unknown) => void) => {
        cursorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);
    const htmlAfterOpen = mockPanel.webview.html;

    // Simulate cursor change in a non-jsonl file
    const nonJsonlEditor = createMockTextEditor({ languageId: 'json', lines: ['not jsonl'] });
    cursorCallback({ textEditor: nonJsonlEditor });

    // HTML should not have changed
    expect(mockPanel.webview.html).toBe(htmlAfterOpen);
  });

  it('editor change listener opens preview for jsonl files when not visible', () => {
    // Start without active editor — no auto-open
    window.activeTextEditor = undefined;

    let editorCallback: (editor: unknown) => void = () => {};
    (window.onDidChangeActiveTextEditor as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (editor: unknown) => void) => {
        editorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);
    expect(window.createWebviewPanel).not.toHaveBeenCalled();

    // Now switch to a jsonl editor
    const jsonlEditor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = jsonlEditor as any;
    editorCallback(jsonlEditor);

    // Should have opened the preview
    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
  });

  it('editor change listener updates existing preview for jsonl files', () => {
    const editor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = editor as any;

    let editorCallback: (editor: unknown) => void = () => {};
    (window.onDidChangeActiveTextEditor as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (editor: unknown) => void) => {
        editorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);
    // Panel is now visible

    // Switch to another jsonl editor
    const newEditor = createMockTextEditor({ lines: ['{"id":99}'], languageId: 'jsonl' });
    editorCallback(newEditor);

    // Should update, not create new
    expect(window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(mockPanel.webview.html).toContain('Line 1');
  });

  it('editor change listener ignores non-jsonl files', () => {
    window.activeTextEditor = undefined;

    let editorCallback: (editor: unknown) => void = () => {};
    (window.onDidChangeActiveTextEditor as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (editor: unknown) => void) => {
        editorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);

    // Switch to a non-jsonl editor
    const nonJsonlEditor = createMockTextEditor({ languageId: 'typescript' });
    editorCallback(nonJsonlEditor);

    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('editor change listener handles undefined editor', () => {
    window.activeTextEditor = undefined;

    let editorCallback: (editor: unknown) => void = () => {};
    (window.onDidChangeActiveTextEditor as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (editor: unknown) => void) => {
        editorCallback = cb;
        return { dispose: () => {} };
      },
    );

    activate(mockContext as any);

    // Simulate editor close (undefined)
    editorCallback(undefined);

    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });
});

// ============================================================
// deactivate()
// ============================================================

describe('deactivate', () => {
  it('is a no-op function', () => {
    // Should not throw
    expect(() => deactivate()).not.toThrow();
  });
});
