import type { WebviewContentOptions } from '../types';
import { escapeHtml, escapeJsonForHtml } from '../utils/htmlUtils';

export function getWebviewContent(options: WebviewContentOptions): string {
    const { json, lineNumber, isError, reorderEnabled, wordWrapEnabled, uriDecodeEnabled, customOrder, filters, cssUri, jsUri } = options;

    const content = isError
        ? `<div class="error">${escapeHtml(String(json))}</div>`
        : `<div class="json-container${wordWrapEnabled ? ' word-wrap' : ''}"></div>`;

    const jsonString = isError ? '' : JSON.stringify(json);

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
        .toolbar-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .hamburger-wrapper {
            position: relative;
        }
        .hamburger-btn {
            padding: 4px 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            transition: background-color 0.2s;
        }
        .hamburger-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .dropdown-menu {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 4px;
            min-width: 180px;
            background-color: var(--vscode-menu-background, var(--vscode-editor-background));
            color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
            border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
            border-radius: 4px;
            box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.3));
            z-index: 100;
            padding: 4px 0;
        }
        .dropdown-menu.open {
            display: block;
        }
        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        .dropdown-item:hover {
            background-color: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
            color: var(--vscode-menu-selectionForeground, var(--vscode-editor-foreground));
        }
        .dropdown-check {
            width: 14px;
            text-align: center;
            font-size: 12px;
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
            box-shadow: 0 4px 20px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.3));
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
        /* Override pretty-print-json library defaults for theme compatibility */
        .json-container {
            background-color: transparent !important;
            padding: 15px;
            border-radius: 4px;
            overflow: auto;
            white-space: pre;
        }
        .json-container.word-wrap {
            white-space: pre-wrap;
            overflow-wrap: break-word;
        }
        .json-container.word-wrap pre {
            white-space: pre-wrap;
            overflow-wrap: break-word;
        }
        .json-container pre {
            margin: 0;
            font-size: 13px;
            line-height: 1.8;
            white-space: pre;
        }
        /* JSON syntax colors using VS Code theme variables with sensible fallbacks */
        .json-key {
            color: var(--vscode-debugTokenExpression-name, #9CDCFE) !important;
        }
        .json-string {
            color: var(--vscode-debugTokenExpression-string, #CE9178) !important;
        }
        .json-number {
            color: var(--vscode-debugTokenExpression-number, #B5CEA8) !important;
        }
        .json-boolean {
            color: var(--vscode-debugTokenExpression-boolean, #569CD6) !important;
        }
        .json-null {
            color: var(--vscode-debugTokenExpression-value, #569CD6) !important;
        }
        .json-mark {
            color: var(--vscode-editor-foreground) !important;
        }
        /* Override library link colors */
        a.json-link {
            color: var(--vscode-textLink-foreground) !important;
        }
        a.json-link:hover {
            color: var(--vscode-textLink-activeForeground) !important;
        }
        a.json-link:visited {
            color: var(--vscode-textLink-foreground) !important;
        }
        /* Override library alternating row backgrounds */
        ol.json-lines > li:nth-child(odd),
        ol.json-lines > li:nth-child(even) {
            background-color: transparent !important;
        }
        ol.json-lines > li:hover {
            background-color: var(--vscode-list-hoverBackground) !important;
        }
        ol.json-lines > li::marker {
            color: var(--vscode-editorLineNumber-foreground) !important;
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
        <div class="toolbar-controls">
            <button class="custom-order-btn ${filters.length > 0 ? 'active' : ''}" id="filter-btn">
                Filter${filters.length > 0 ? ` (${filters.length})` : ''}
            </button>
            <button class="custom-order-btn ${customOrder.length > 0 ? 'active' : ''}" id="custom-order-btn">
                Custom Order${customOrder.length > 0 ? ` (${customOrder.length})` : ''}
            </button>
            <div class="hamburger-wrapper">
                <button class="hamburger-btn" id="hamburger-btn" title="Options" aria-haspopup="true" aria-expanded="false">&#9776;</button>
                <div class="dropdown-menu" id="dropdown-menu" role="menu">
                    <div class="dropdown-item" id="toggle-reorder" data-command="toggleReorder" role="menuitemcheckbox" aria-checked="${reorderEnabled ? 'true' : 'false'}">
                        <span class="dropdown-check">${reorderEnabled ? '&#10003;' : ''}</span>
                        <span>Reorder Keys</span>
                    </div>
                    <div class="dropdown-item" id="toggle-wordwrap" data-command="toggleWordWrap" role="menuitemcheckbox" aria-checked="${wordWrapEnabled ? 'true' : 'false'}">
                        <span class="dropdown-check">${wordWrapEnabled ? '&#10003;' : ''}</span>
                        <span>Word Wrap</span>
                    </div>
                    <div class="dropdown-item" id="toggle-uridecode" data-command="toggleUriDecode" role="menuitemcheckbox" aria-checked="${uriDecodeEnabled ? 'true' : 'false'}">
                        <span class="dropdown-check">${uriDecodeEnabled ? '&#10003;' : ''}</span>
                        <span>Decode Strings</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    ${content}
    ${isError ? '' : `<script id="json-data" type="application/json">${escapeJsonForHtml(jsonString)}</script>`}

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
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const dropdownMenu = document.getElementById('dropdown-menu');
        const customOrderBtn = document.getElementById('custom-order-btn');
        const filterBtn = document.getElementById('filter-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const filterOverlay = document.getElementById('filter-overlay');
        const customOrderInput = document.getElementById('custom-order-input');
        const modalCancel = document.getElementById('modal-cancel');
        const modalClear = document.getElementById('modal-clear');
        const modalApply = document.getElementById('modal-apply');

        let currentFilters = ${escapeJsonForHtml(JSON.stringify(filters))};

        // Hamburger menu
        function openMenu() {
            dropdownMenu.classList.add('open');
            hamburgerBtn.setAttribute('aria-expanded', 'true');
        }

        function closeMenu() {
            dropdownMenu.classList.remove('open');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
        }

        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownMenu.classList.contains('open');
            if (isOpen) { closeMenu(); } else { openMenu(); }
        });

        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== hamburgerBtn) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdownMenu.classList.contains('open')) {
                closeMenu();
                hamburgerBtn.focus();
            }
        });

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const command = item.getAttribute('data-command');
                const check = item.querySelector('.dropdown-check');
                const isActive = check.textContent.trim() !== '';
                vscode.postMessage({ command, value: !isActive });
                closeMenu();
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
            const jsonDataEl = document.getElementById('json-data');
            const jsonData = JSON.parse(jsonDataEl.textContent);
            const container = document.querySelector('.json-container');
            if (jsonData !== null && container && typeof prettyPrintJson !== 'undefined') {
                container.innerHTML = prettyPrintJson.toHtml(jsonData, {
                    indent: 2,
                    lineNumbers: false,
                    linkUrls: true,
                    quoteKeys: false
                });
                if (${uriDecodeEnabled}) {
                    container.querySelectorAll('.json-string').forEach(function(el) {
                        var text = el.textContent;
                        if (text && text.length > 2 && text.startsWith('"') && text.endsWith('"')) {
                            try {
                                var raw = JSON.parse(text);
                                if (typeof raw === 'string' && raw !== text.slice(1, -1)) {
                                    el.textContent = '"' + raw + '"';
                                }
                            } catch(e) {
                                // Leave as-is if parsing fails
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error rendering JSON:', error);
            document.querySelector('.json-container').innerHTML = '<div class="error">Error rendering JSON: ' + escapeHtml(error.message) + '</div>';
        }
        `}
    </script>
</body>
</html>`;
}
