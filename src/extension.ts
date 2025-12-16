// extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let previewPanel: vscode.WebviewPanel | undefined;
let decorationType: vscode.TextEditorDecorationType;
let reorderKeys = false;
let customOrder: string[] = [];
let lastEditor: vscode.TextEditor | undefined;
let activeFilters: {key: string, value: string}[] = [];
let filteredDocument: vscode.TextDocument | undefined;
let originalDocument: vscode.TextDocument | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Create decoration type for highlighting the current line
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.2)',
        isWholeLine: true,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255, 200, 0, 0.5)'
    });

    // Load custom order from global state
    customOrder = context.globalState.get<string[]>('ndjson-preview.customOrder', []);

    // Register command to open preview
    const openPreview = vscode.commands.registerCommand('ndjson-preview.open', () => {
        showPreview(context);
    });

    // Listen to cursor position changes
    const cursorListener = vscode.window.onDidChangeTextEditorSelection(event => {
        if (previewPanel && event.textEditor.document.languageId === 'jsonl') {
            updatePreview(event.textEditor, context);
        }
    });

    // Listen to active editor changes
    const editorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'jsonl') {
            if (!previewPanel) {
                showPreview(context);
            } else {
                updatePreview(editor, context);
            }
        }
    });

    // Auto-open preview for NDJSON files when extension activates
    if (vscode.window.activeTextEditor?.document.languageId === 'jsonl') {
        showPreview(context);
    }

    context.subscriptions.push(openPreview, cursorListener, editorListener);
}

function showPreview(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        previewPanel = vscode.window.createWebviewPanel(
            'ndjsonPreview',
            'NDJSON Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'pretty-print-json'))]
            }
        );

        // Handle messages from the webview
        previewPanel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'toggleReorder') {
                    reorderKeys = message.value;
                    if (lastEditor) {
                        updatePreview(lastEditor, context);
                    }
                } else if (message.command === 'setCustomOrder') {
                    customOrder = message.value;
                    // Save to global state
                    context.globalState.update('ndjson-preview.customOrder', customOrder);
                    if (lastEditor) {
                        updatePreview(lastEditor, context);
                    }
                } else if (message.command === 'setFilters') {
                    activeFilters = message.value;
                    if (lastEditor) {
                        if (activeFilters.length > 0) {
                            createFilteredView(lastEditor, context);
                        } else {
                            closeFilteredView();
                        }
                        updatePreview(lastEditor, context);
                    }
                }
            },
            undefined,
            context.subscriptions
        );

        previewPanel.onDidDispose(() => {
            previewPanel = undefined;
            // Clear decorations when panel closes
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.setDecorations(decorationType, []);
            }
        });
    }

    updatePreview(editor, context);
}

function updatePreview(editor: vscode.TextEditor, context: vscode.ExtensionContext) {
    if (!previewPanel) return;

    // Store the editor for future updates
    lastEditor = editor;

    const line = editor.selection.active.line;
    const lineText = editor.document.lineAt(line).text.trim();

    // Clear previous decorations
    editor.setDecorations(decorationType, []);

    // Highlight current line
    const range = editor.document.lineAt(line).range;
    editor.setDecorations(decorationType, [range]);

    let html: string;
    
    if (!lineText) {
        html = getWebviewContent(null, line + 1, true, reorderKeys, customOrder, activeFilters, context);
    } else {
        try {
            let json = JSON.parse(lineText);
            if (customOrder.length > 0) {
                json = applyCustomOrder(json, customOrder);
            } else if (reorderKeys) {
                json = reorderJsonKeys(json);
            }
            html = getWebviewContent(json, line + 1, false, reorderKeys, customOrder, activeFilters, context);
        } catch (error) {
            html = getWebviewContent(
                `Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`,
                line + 1,
                true,
                reorderKeys,
                customOrder,
                activeFilters,
                context
            );
        }
    }

    previewPanel.webview.html = html;
}

function reorderJsonKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => reorderJsonKeys(item));
    }

    const primitives: any = {};
    const objects: any = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (value !== null && typeof value === 'object') {
                objects[key] = reorderJsonKeys(value);
            } else {
                primitives[key] = value;
            }
        }
    }

    return { ...primitives, ...objects };
}

function applyCustomOrder(obj: any, order: string[]): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => applyCustomOrder(item, order));
    }

    const ordered: any = {};
    const remaining: any = {};

    // First, add keys in the specified order
    for (const key of order) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            ordered[key] = (value !== null && typeof value === 'object') 
                ? applyCustomOrder(value, order) 
                : value;
        }
    }

    // Then add any remaining keys
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !order.includes(key)) {
            const value = obj[key];
            remaining[key] = (value !== null && typeof value === 'object') 
                ? applyCustomOrder(value, order) 
                : value;
        }
    }

    return { ...ordered, ...remaining };
}

async function createFilteredView(editor: vscode.TextEditor, context: vscode.ExtensionContext) {
    const document = editor.document;
    const filteredLines: string[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text.trim();
        if (!lineText) continue;

        try {
            const json = JSON.parse(lineText);
            let matches = true;

            for (const filter of activeFilters) {
                const value = getNestedValue(json, filter.key);
                if (value === undefined || String(value) !== filter.value) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                filteredLines.push(lineText);
            }
        } catch (error) {
            // Skip invalid JSON
        }
    }

    // Create a new untitled document with filtered content
    const content = filteredLines.join('\n');
    originalDocument = document;
    filteredDocument = await vscode.workspace.openTextDocument({
        content: content,
        language: 'jsonl'
    });

    await vscode.window.showTextDocument(filteredDocument, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
        preserveFocus: false
    });

    vscode.window.showInformationMessage(`Showing ${filteredLines.length} of ${document.lineCount} lines`);
}

function closeFilteredView() {
    if (filteredDocument) {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document === filteredDocument) {
                vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });
        filteredDocument = undefined;
        originalDocument = undefined;
    }
}

function getNestedValue(obj: any, key: string): any {
    const keys = key.split('.');
    let value = obj;
    
    for (const k of keys) {
        if (value === null || value === undefined) {
            return undefined;
        }
        value = value[k];
    }
    
    return value;
}

function getWebviewContent(json: any, lineNumber: number, isError: boolean, reorderEnabled: boolean, customOrder: string[], filters: {key: string, value: string}[], context: vscode.ExtensionContext): string {
    const content = isError 
        ? `<div class="error">${escapeHtml(String(json))}</div>`
        : `<div class="json-container"></div>`;
    
    const jsonString = isError ? '' : JSON.stringify(json);

    // Get URIs for the library files
    const libPath = path.join(context.extensionPath, 'node_modules', 'pretty-print-json');
    const cssUri = previewPanel!.webview.asWebviewUri(vscode.Uri.file(path.join(libPath, 'dist', 'css', 'pretty-print-json.css')));
    const jsUri = previewPanel!.webview.asWebviewUri(vscode.Uri.file(path.join(libPath, 'dist', 'pretty-print-json.min.js')));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NDJSON Preview</title>
    <link rel="stylesheet" href="${cssUri}">
    <style>
        body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
        }
        .header {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .line-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toggle-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toggle-label {
            font-size: 12px;
            cursor: pointer;
            user-select: none;
        }
        .toggle-switch {
            position: relative;
            width: 40px;
            height: 20px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 10px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .toggle-switch.active {
            background-color: var(--vscode-button-background);
        }
        .toggle-slider {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 14px;
            height: 14px;
            background-color: var(--vscode-editor-foreground);
            border-radius: 50%;
            transition: transform 0.2s;
        }
        .toggle-switch.active .toggle-slider {
            transform: translateX(20px);
        }
        .custom-order-btn {
            padding: 4px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        .custom-order-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .custom-order-btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal-overlay.show {
            display: flex;
        }
        .modal {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .modal-header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-editor-foreground);
        }
        .modal-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 15px;
        }
        .modal textarea {
            width: 100%;
            min-height: 200px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            box-sizing: border-box;
        }
        .modal textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            justify-content: flex-end;
        }
        .modal-btn {
            padding: 6px 14px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-size: 13px;
        }
        .modal-btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .modal-btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .modal-btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .modal-btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .filter-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }
        .filter-tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .filter-tag-remove {
            cursor: pointer;
            font-weight: bold;
            opacity: 0.7;
        }
        .filter-tag-remove:hover {
            opacity: 1;
        }
        .filter-inputs {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        }
        .filter-inputs input {
            flex: 1;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
        }
        .filter-inputs input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .filter-add-btn {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .filter-add-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .filter-add-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .json-container {
            padding: 15px;
            border-radius: 4px;
            overflow: auto;
        }
        .json-container pre {
            margin: 0;
            font-size: 13px;
            line-height: 1.8;
            white-space: pre;
        }
        /* Ensure the library output respects whitespace */
        .json-container {
            white-space: pre;
        }
        /* Override pretty-print-json colors to match VS Code theme */
        .json-key {
            color: #9CDCFE !important;
        }
        .json-string {
            color: #CE9178 !important;
        }
        .json-number {
            color: #B5CEA8 !important;
        }
        .json-boolean {
            color: #569CD6 !important;
        }
        .json-null {
            color: #569CD6 !important;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            padding: 15px;
            border-radius: 4px;
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="line-info">Line ${lineNumber}</div>
        <div class="toggle-container">
            <button class="custom-order-btn ${filters.length > 0 ? 'active' : ''}" id="filter-btn">
                Filter${filters.length > 0 ? ` (${filters.length})` : ''}
            </button>
            <button class="custom-order-btn ${customOrder.length > 0 ? 'active' : ''}" id="custom-order-btn">
                Custom Order${customOrder.length > 0 ? ` (${customOrder.length})` : ''}
            </button>
            <label class="toggle-label" for="reorder-toggle">Reorder Keys</label>
            <div class="toggle-switch ${reorderEnabled ? 'active' : ''}" id="reorder-toggle">
                <div class="toggle-slider"></div>
            </div>
        </div>
    </div>
    ${content}
    
    <div class="modal-overlay" id="filter-overlay">
        <div class="modal">
            <div class="modal-header">Filter Lines</div>
            <div class="modal-description">Filter lines by key-value pairs. Only lines matching ALL filters will be shown. Use dot notation for nested keys (e.g., "user.name").</div>
            
            <div class="filter-list" id="filter-list">
                ${filters.map((f, i) => `
                    <div class="filter-tag">
                        <span>${escapeHtml(f.key)}: ${escapeHtml(f.value)}</span>
                        <span class="filter-tag-remove" data-index="${i}">×</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="filter-inputs">
                <input type="text" id="filter-key" placeholder="Key (e.g., status or user.name)" />
                <input type="text" id="filter-value" placeholder="Value" />
                <button class="filter-add-btn" id="filter-add">Add</button>
            </div>
            
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-secondary" id="filter-cancel">Cancel</button>
                <button class="modal-btn modal-btn-secondary" id="filter-clear">Clear All</button>
                <button class="modal-btn modal-btn-primary" id="filter-apply">Apply</button>
            </div>
        </div>
    </div>
    
    <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
            <div class="modal-header">Custom Key Order</div>
            <div class="modal-description">Enter one key per line to define the order. Keys will appear in this order, followed by any remaining keys.</div>
            <textarea id="custom-order-input" placeholder="key1
key2
key3">${customOrder.join('\n')}</textarea>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
                <button class="modal-btn modal-btn-secondary" id="modal-clear">Clear</button>
                <button class="modal-btn modal-btn-primary" id="modal-apply">Apply</button>
            </div>
        </div>
    </div>
    <script src="${jsUri}"></script>
    <script>
        const vscode = acquireVsCodeApi();
        const toggle = document.getElementById('reorder-toggle');
        const customOrderBtn = document.getElementById('custom-order-btn');
        const filterBtn = document.getElementById('filter-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const filterOverlay = document.getElementById('filter-overlay');
        const customOrderInput = document.getElementById('custom-order-input');
        const modalCancel = document.getElementById('modal-cancel');
        const modalClear = document.getElementById('modal-clear');
        const modalApply = document.getElementById('modal-apply');
        
        let currentFilters = ${JSON.stringify(filters)};
        
        toggle.addEventListener('click', () => {
            const isActive = toggle.classList.contains('active');
            vscode.postMessage({
                command: 'toggleReorder',
                value: !isActive
            });
        });

        customOrderBtn.addEventListener('click', () => {
            modalOverlay.classList.add('show');
            customOrderInput.focus();
        });

        modalCancel.addEventListener('click', () => {
            modalOverlay.classList.remove('show');
        });

        modalClear.addEventListener('click', () => {
            customOrderInput.value = '';
            vscode.postMessage({
                command: 'setCustomOrder',
                value: []
            });
            modalOverlay.classList.remove('show');
        });

        modalApply.addEventListener('click', () => {
            const value = customOrderInput.value;
            const keys = value.split('\\n').map(k => k.trim()).filter(k => k.length > 0);
            vscode.postMessage({
                command: 'setCustomOrder',
                value: keys
            });
            modalOverlay.classList.remove('show');
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('show');
            }
        });

        // Filter functionality
        filterBtn.addEventListener('click', () => {
            filterOverlay.classList.add('show');
            document.getElementById('filter-key').focus();
        });

        document.getElementById('filter-cancel').addEventListener('click', () => {
            filterOverlay.classList.remove('show');
        });

        document.getElementById('filter-clear').addEventListener('click', () => {
            currentFilters = [];
            vscode.postMessage({
                command: 'setFilters',
                value: currentFilters
            });
            filterOverlay.classList.remove('show');
        });

        document.getElementById('filter-apply').addEventListener('click', () => {
            vscode.postMessage({
                command: 'setFilters',
                value: currentFilters
            });
            filterOverlay.classList.remove('show');
        });

        document.getElementById('filter-add').addEventListener('click', () => {
            const key = document.getElementById('filter-key').value.trim();
            const value = document.getElementById('filter-value').value.trim();
            
            if (key && value) {
                currentFilters.push({ key, value });
                updateFilterList();
                document.getElementById('filter-key').value = '';
                document.getElementById('filter-value').value = '';
                document.getElementById('filter-key').focus();
            }
        });

        document.getElementById('filter-key').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('filter-value').focus();
            }
        });

        document.getElementById('filter-value').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('filter-add').click();
            }
        });

        function updateFilterList() {
            const filterList = document.getElementById('filter-list');
            filterList.innerHTML = currentFilters.map((f, i) => 
                \`<div class="filter-tag">
                    <span>\${escapeHtml(f.key)}: \${escapeHtml(f.value)}</span>
                    <span class="filter-tag-remove" data-index="\${i}">×</span>
                </div>\`
            ).join('');
            
            // Re-attach event listeners
            document.querySelectorAll('.filter-tag-remove').forEach(el => {
                el.addEventListener('click', () => {
                    const index = parseInt(el.getAttribute('data-index'));
                    currentFilters.splice(index, 1);
                    updateFilterList();
                });
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        filterOverlay.addEventListener('click', (e) => {
            if (e.target === filterOverlay) {
                filterOverlay.classList.remove('show');
            }
        });

        // Initialize filter list event listeners
        document.querySelectorAll('.filter-tag-remove').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.getAttribute('data-index'));
                currentFilters.splice(index, 1);
                updateFilterList();
            });
        });

        // Render the JSON with syntax highlighting
        ${isError ? '' : `
        try {
            const jsonData = ${jsonString};
            const container = document.querySelector('.json-container');
            if (jsonData !== null && container && typeof prettyPrintJson !== 'undefined') {
                container.innerHTML = prettyPrintJson.toHtml(jsonData, {
                    indent: 2,
                    lineNumbers: false,
                    linkUrls: true,
                    quoteKeys: false
                });
            }
        } catch (error) {
            console.error('Error rendering JSON:', error);
            document.querySelector('.json-container').innerHTML = '<div class="error">Error rendering JSON: ' + error.message + '</div>';
        }
        `}
    </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
    closeFilteredView();
}