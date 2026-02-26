/**
 * Mock VS Code API for unit testing.
 * Provides minimal stubs for the vscode module methods used by PreviewPanel and extension.ts.
 */
import { vi } from 'vitest';

// --- URI ---
export class Uri {
  static file(path: string): Uri {
    return new Uri(`file://${path}`);
  }
  constructor(public readonly fsPath: string) {}
  toString(): string {
    return this.fsPath;
  }
}

// --- ViewColumn ---
export enum ViewColumn {
  Beside = 2,
}

// --- Disposable ---
export class Disposable {
  constructor(private callOnDispose: () => void) {}
  dispose(): void {
    this.callOnDispose();
  }
}

// --- Range ---
export class Range {
  constructor(
    public readonly start: { line: number; character: number },
    public readonly end: { line: number; character: number },
  ) {}
}

// --- Mock factories ---

export function createMockWebviewPanel() {
  const onDidReceiveMessageListeners: ((msg: unknown) => void)[] = [];
  const onDidDisposeListeners: (() => void)[] = [];

  return {
    webview: {
      html: '',
      onDidReceiveMessage: vi.fn((listener: (msg: unknown) => void) => {
        onDidReceiveMessageListeners.push(listener);
        return new Disposable(() => {});
      }),
      asWebviewUri: vi.fn((uri: Uri) => uri),
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn((listener: () => void) => {
      onDidDisposeListeners.push(listener);
      return new Disposable(() => {});
    }),
    dispose: vi.fn(),
    // Test helpers
    _fireMessage: (msg: unknown) => {
      for (const l of onDidReceiveMessageListeners) l(msg);
    },
    _fireDispose: () => {
      for (const l of onDidDisposeListeners) l();
    },
  };
}

export function createMockTextEditor(options: {
  lines?: string[];
  languageId?: string;
  activeLine?: number;
} = {}) {
  const lines = options.lines ?? ['{"id":1,"name":"Alice"}'];
  const activeLine = options.activeLine ?? 0;
  const languageId = options.languageId ?? 'jsonl';

  return {
    document: {
      languageId,
      lineCount: lines.length,
      lineAt: vi.fn((lineNum: number) => ({
        text: lines[lineNum] ?? '',
        range: new Range(
          { line: lineNum, character: 0 },
          { line: lineNum, character: (lines[lineNum] ?? '').length },
        ),
      })),
    },
    selection: {
      active: { line: activeLine, character: 0 },
    },
    setDecorations: vi.fn(),
  };
}

export function createMockExtensionContext(overrides: Record<string, unknown> = {}) {
  const globalStateStore: Record<string, unknown> = {};
  return {
    extensionPath: '/mock/extension/path',
    subscriptions: [] as { dispose: () => void }[],
    globalState: {
      get: vi.fn(<T>(key: string, defaultValue?: T): T => {
        return (globalStateStore[key] as T) ?? (defaultValue as T);
      }),
      update: vi.fn((key: string, value: unknown) => {
        globalStateStore[key] = value;
        return Promise.resolve();
      }),
      _store: globalStateStore,
    },
    ...overrides,
  };
}

// --- The mock vscode module ---

const mockPanel = createMockWebviewPanel();

export const window = {
  createTextEditorDecorationType: vi.fn(() => ({
    dispose: vi.fn(),
  })),
  createWebviewPanel: vi.fn(() => mockPanel),
  activeTextEditor: undefined as ReturnType<typeof createMockTextEditor> | undefined,
  showErrorMessage: vi.fn(),
  showTextDocument: vi.fn(),
  showInformationMessage: vi.fn(),
  onDidChangeTextEditorSelection: vi.fn(() => new Disposable(() => {})),
  onDidChangeActiveTextEditor: vi.fn(() => new Disposable(() => {})),
  visibleTextEditors: [] as unknown[],
};

export const workspace = {
  openTextDocument: vi.fn(() => Promise.resolve({ uri: Uri.file('/mock/filtered') })),
};

export const commands = {
  registerCommand: vi.fn((_cmd: string, callback: () => void) => {
    return { dispose: () => {}, _callback: callback };
  }),
  executeCommand: vi.fn(),
};

// Export default for module aliasing
export default {
  Uri,
  ViewColumn,
  Disposable,
  Range,
  window,
  workspace,
  commands,
};
