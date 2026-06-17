---
name: shareable-html
description: Create public HTML mini-sites for structured review, feedback collection, and agent-readable shared JSON state through the Shareable Agent HTML MCP service.
---

# Shareable HTML

Use this skill when a user needs a shareable, browser-native review surface instead of Markdown: migration decisions, checklist feedback, structured approvals, data audits, or one-off internal tools.

## Workflow

1. Build a focused HTML mini-site with clear labels and enough context for reviewers.
2. Mark every editable field with a stable `data-field` path.
3. Provide an initial JSON `state` with all expected keys.
4. Upload with the `create_document` MCP tool.
5. Give the user the returned public URL.
6. After review, use `get_document_state` to retrieve the shared JSON state.

## HTML Rules

- Use semantic HTML and a compact, practical UI.
- Include all decision context in the page, not only in the JSON.
- Prefer stable field paths like `pages.0.action`, `pages.0.notes`, `approvals.legalApproved`.
- Use relative asset paths for CSS, JS, and images.
- Do not include secrets in the HTML, JavaScript, or initial state.

## Interactive Fields

Examples:

```html
<input type="checkbox" data-field="pages.0.remove">
<select data-field="pages.0.action">
  <option value="keep">Keep</option>
  <option value="remove">Remove</option>
  <option value="merge">Merge</option>
</select>
<textarea data-field="pages.0.notes"></textarea>
<button data-save>Save</button>
<span data-save-status></span>
```

The hosted service injects the state SDK automatically. You may explicitly add:

```html
<script src="/agent-html-sdk.js" defer></script>
```

## Custom JavaScript

Custom JavaScript is allowed for page-specific functionality. Keep persistence standardized:

- Use `data-field` for persisted inputs.
- Use `window.AgentHtmlState.load()`, `save()`, `getState()`, and `setState()` when custom code needs state access.
- Listen for `agent-html-state-loaded` and `agent-html-state-saved` for reactive UI behavior.
- Use local uploaded JS files such as `app.js` for filtering, sorting, charts, validation, and derived summaries.
- Do not embed secrets, API keys, or private tokens.

## MCP Tools

- `create_document`: upload HTML or a full mini-site.
- `update_document`: edit the HTML, assets, metadata, or state.
- `list_documents`: find existing documents.
- `get_document`: inspect URL, metadata, file list, and current state.
- `get_document_state`: retrieve reviewer input.
- `update_document_state`: overwrite shared state.
- `patch_document_state`: update a few shared state fields.
- `delete_document`: remove a document.
