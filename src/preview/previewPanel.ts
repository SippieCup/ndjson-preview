import * as path from 'path';
import * as vscode from 'vscode';
import type { Filter, PreviewState } from '../types';
import { filterLines } from '../utils/filterUtils';
import { applyCustomOrder, decodeUriStrings, reorderJsonKeys } from '../utils/jsonUtils';
import { getWebviewContent } from '../webview/webviewContent';

export class PreviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    private readonly decorationType: vscode.TextEditorDecorationType;
    private lastEditor: vscode.TextEditor | undefined;
    private filteredDocument: vscode.TextDocument | undefined;
    private readonly state: PreviewState;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 200, 0, 0.2)',
            isWholeLine: true,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'rgba(255, 200, 0, 0.5)',
        });

        this.state = {
            reorderKeys: false,
            wordWrap: false,
            uriDecode: false,
            customOrder: context.globalState.get<string[]>('ndjson-preview.customOrder', []),
            activeFilters: [],
        };
    }

    get isVisible(): boolean {
        return this.panel !== undefined;
    }

    show(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'ndjsonPreview',
                'NDJSON Preview',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'pretty-print-json')),
                    ],
                },
            );

            this.panel.webview.onDidReceiveMessage(
                message => this.handleMessage(message),
                undefined,
                this.context.subscriptions,
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
                if (vscode.window.activeTextEditor) {
                    vscode.window.activeTextEditor.setDecorations(this.decorationType, []);
                }
            });
        }

        this.update(editor);
    }

    update(editor: vscode.TextEditor): void {
        if (!this.panel) {
            return;
        }

        this.lastEditor = editor;

        const line = editor.selection.active.line;
        const lineText = editor.document.lineAt(line).text.trim();

        // Clear previous decorations and highlight current line
        editor.setDecorations(this.decorationType, []);
        const range = editor.document.lineAt(line).range;
        editor.setDecorations(this.decorationType, [range]);

        const { cssUri, jsUri } = this.getLibraryUris();

        let html: string;

        if (!lineText) {
            html = getWebviewContent({
                json: null,
                lineNumber: line + 1,
                isError: true,
                reorderEnabled: this.state.reorderKeys,
                wordWrapEnabled: this.state.wordWrap,
                uriDecodeEnabled: this.state.uriDecode,
                customOrder: this.state.customOrder,
                filters: this.state.activeFilters,
                cssUri,
                jsUri,
            });
        } else {
            try {
                let json: unknown = JSON.parse(lineText);
                if (this.state.customOrder.length > 0) {
                    json = applyCustomOrder(json, this.state.customOrder);
                } else if (this.state.reorderKeys) {
                    json = reorderJsonKeys(json);
                }
                if (this.state.uriDecode) {
                    json = decodeUriStrings(json);
                }
                html = getWebviewContent({
                    json,
                    lineNumber: line + 1,
                    isError: false,
                    reorderEnabled: this.state.reorderKeys,
                    wordWrapEnabled: this.state.wordWrap,
                    uriDecodeEnabled: this.state.uriDecode,
                    customOrder: this.state.customOrder,
                    filters: this.state.activeFilters,
                    cssUri,
                    jsUri,
                });
            } catch (error) {
                html = getWebviewContent({
                    json: `Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`,
                    lineNumber: line + 1,
                    isError: true,
                    reorderEnabled: this.state.reorderKeys,
                    wordWrapEnabled: this.state.wordWrap,
                    uriDecodeEnabled: this.state.uriDecode,
                    customOrder: this.state.customOrder,
                    filters: this.state.activeFilters,
                    cssUri,
                    jsUri,
                });
            }
        }

        this.panel.webview.html = html;
    }

    dispose(): void {
        this.decorationType.dispose();
        this.closeFilteredView();
    }

    private handleMessage(message: { command: string; value: unknown }): void {
        switch (message.command) {
            case 'toggleReorder':
                this.state.reorderKeys = message.value as boolean;
                if (this.lastEditor) {
                    this.update(this.lastEditor);
                }
                break;

            case 'toggleWordWrap':
                this.state.wordWrap = message.value as boolean;
                if (this.lastEditor) {
                    this.update(this.lastEditor);
                }
                break;

            case 'toggleUriDecode':
                this.state.uriDecode = message.value as boolean;
                if (this.lastEditor) {
                    this.update(this.lastEditor);
                }
                break;

            case 'setCustomOrder':
                this.state.customOrder = message.value as string[];
                this.context.globalState.update('ndjson-preview.customOrder', this.state.customOrder);
                if (this.lastEditor) {
                    this.update(this.lastEditor);
                }
                break;

            case 'setFilters':
                this.state.activeFilters = message.value as Filter[];
                if (this.lastEditor) {
                    if (this.state.activeFilters.length > 0) {
                        this.createFilteredView(this.lastEditor);
                    } else {
                        this.closeFilteredView();
                    }
                    this.update(this.lastEditor);
                }
                break;
        }
    }

    private getLibraryUris(): { cssUri: string; jsUri: string } {
        if (!this.panel) {
            throw new Error('Panel is not initialized');
        }
        const libPath = path.join(this.context.extensionPath, 'node_modules', 'pretty-print-json');
        const cssUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(libPath, 'dist', 'css', 'pretty-print-json.css')),
        ).toString();
        const jsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(libPath, 'dist', 'pretty-print-json.min.js')),
        ).toString();
        return { cssUri, jsUri };
    }

    private async createFilteredView(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const lines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }

        const filteredResult = filterLines(lines, this.state.activeFilters);

        const content = filteredResult.join('\n');
        this.filteredDocument = await vscode.workspace.openTextDocument({
            content,
            language: 'jsonl',
        });

        await vscode.window.showTextDocument(this.filteredDocument, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false,
            preserveFocus: false,
        });

        vscode.window.showInformationMessage(
            `Showing ${filteredResult.length} of ${document.lineCount} lines`,
        );
    }

    private closeFilteredView(): void {
        if (this.filteredDocument) {
            vscode.window.visibleTextEditors.forEach(editor => {
                if (editor.document === this.filteredDocument) {
                    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                }
            });
            this.filteredDocument = undefined;
        }
    }
}
