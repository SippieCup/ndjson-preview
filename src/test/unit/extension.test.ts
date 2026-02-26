import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  window,
  commands,
  createMockTextEditor,
  createMockExtensionContext,
  createMockWebviewPanel,
} from '../mocks/vscode';
import { activate, deactivate } from '../../extension';
import type * as vscode from 'vscode';

beforeEach(() => {
  vi.clearAllMocks();
  window.activeTextEditor = undefined;
  window.createWebviewPanel.mockImplementation(() => createMockWebviewPanel());
});

describe('activate()', () => {
  it('registers the ndjson-preview.open command', () => {
    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'ndjson-preview.open',
      expect.any(Function),
    );
  });

  it('registers cursor change listener', () => {
    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(window.onDidChangeTextEditorSelection).toHaveBeenCalledOnce();
  });

  it('registers active editor change listener', () => {
    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(window.onDidChangeActiveTextEditor).toHaveBeenCalledOnce();
  });

  it('pushes disposables to context.subscriptions', () => {
    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    // Should push: openPreview command, cursorListener, editorListener, dispose wrapper
    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(4);
  });

  it('auto-opens preview when active editor is jsonl', () => {
    const editor = createMockTextEditor({ languageId: 'jsonl' });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(window.createWebviewPanel).toHaveBeenCalled();
  });

  it('does not auto-open when active editor is not jsonl', () => {
    const editor = createMockTextEditor({ languageId: 'typescript' });
    window.activeTextEditor = editor as unknown as typeof window.activeTextEditor;

    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('does not auto-open when no active editor', () => {
    window.activeTextEditor = undefined;

    const ctx = createMockExtensionContext();
    activate(ctx as unknown as vscode.ExtensionContext);

    expect(window.createWebviewPanel).not.toHaveBeenCalled();
  });
});

describe('deactivate()', () => {
  it('exports deactivate function', () => {
    expect(typeof deactivate).toBe('function');
    // Should not throw
    deactivate();
  });
});
