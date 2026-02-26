import * as vscode from 'vscode';
import { PreviewPanel } from './preview/previewPanel';

export function activate(context: vscode.ExtensionContext): void {
    const preview = new PreviewPanel(context);

    const openPreview = vscode.commands.registerCommand('ndjson-preview.open', () => {
        preview.show();
    });

    const cursorListener = vscode.window.onDidChangeTextEditorSelection(event => {
        if (preview.isVisible && event.textEditor.document.languageId === 'jsonl') {
            preview.update(event.textEditor);
        }
    });

    const editorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'jsonl') {
            if (!preview.isVisible) {
                preview.show();
            } else {
                preview.update(editor);
            }
        }
    });

    // Auto-open preview for NDJSON files when extension activates
    if (vscode.window.activeTextEditor?.document.languageId === 'jsonl') {
        preview.show();
    }

    context.subscriptions.push(
        openPreview,
        cursorListener,
        editorListener,
        { dispose: () => preview.dispose() },
    );
}

export function deactivate(): void {
    // All cleanup handled via context.subscriptions
}
