/**
 * Escape HTML special characters to prevent injection in rendered HTML.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape a JSON string for safe embedding inside an HTML `<script type="application/json">` block.
 * Replaces `<` with the unicode escape `\u003c` so the HTML parser never sees `</script>`
 * inside the data. JSON.parse handles `\u003c` transparently.
 */
export function escapeJsonForHtml(jsonString: string): string {
    return jsonString.replace(/</g, '\\u003c');
}
