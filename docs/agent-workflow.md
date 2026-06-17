# Agent Workflow

Use this service when HTML is a better review surface than Markdown: structured data audits, migration decisions, checklist reviews, feedback collection, or small one-off tools.

## Build Pattern

1. Create one focused mini-site for the review task.
2. Use `data-field` for every editable decision or note.
3. Initialize `state` with all expected keys so the returned JSON is self-explanatory.
4. Set `expiresAt` when the public review link should stop working after a deadline.
5. Include visible labels, current source data, and enough context that a reviewer can decide without asking the agent.
6. After the reviewer is done, call `get_document_state` and use the JSON as source of truth.

## Field Naming

Prefer stable, descriptive paths:

```html
<input type="checkbox" data-field="pages.0.remove">
<select data-field="pages.0.action">
  <option value="keep">Keep</option>
  <option value="remove">Remove</option>
  <option value="merge">Merge</option>
</select>
<textarea data-field="pages.0.reason"></textarea>
```

Good initial state:

```json
{
  "pages": [
    {
      "url": "/old-page",
      "title": "Old page",
      "action": "keep",
      "remove": false,
      "reason": ""
    }
  ]
}
```

## Asset Uploads

Use `files` for complete mini-sites:

- `index.html`
- `styles.css`
- `app.js`
- `assets/example.png`

Use `encoding: "base64"` for binary files.

## Custom JavaScript

Custom JavaScript is allowed and expected for richer one-off tools. Keep persistence standardized:

- Persist reviewer input with `data-field`.
- Use `window.AgentHtmlState` for explicit load/save/state reads.
- Listen for `agent-html-state-loaded` and `agent-html-state-saved` when custom UI needs to react to shared state.
- Use local JS for sorting, filtering, conditional sections, charts, computed summaries, and validation.
- Never include secrets or API keys in uploaded JS.

## Choice Interfaces

When users need to choose one item from several visual options, use either radios with the same `data-field` or visual cards:

```html
<button type="button" data-choice-field="illustrations.hero" data-choice-value="option-a">
  <img src="assets/hero-a.png" alt="">
</button>
```

The selected value is saved to the shared JSON state. Agents should initialize these fields with a clear default or an empty string.

## Comments

The hosted SDK adds a sticky toolbar with document title, expiry, save status, comment mode, and comment count.

Any persisted field can receive comments automatically. For non-input elements, add a stable comment id:

```html
<div data-comment-id="pricing-table-row-3">...</div>
```

Comments are stored in `_comments` and remain available through `get_document_state`.

## Review Completion

When the user says the review is complete:

1. Call `get_document_state`.
2. If labels/context are needed, call `get_document` to inspect metadata and file list.
3. Use the state to update the source plan, ticket, migration spreadsheet, or implementation.

Use `patch_document_state` only when you intentionally want to update a few fields without replacing reviewer input elsewhere.

## Expiry

Use `expiresAt` to stop public access without deleting the document:

```json
{
  "expiresAt": "2026-07-17T12:00:00.000Z"
}
```

After expiry, public URLs return `410 Gone`, but MCP/API access still works. Use `expiresAt: null` to make the document public again.
