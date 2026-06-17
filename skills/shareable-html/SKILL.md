---
name: shareable-html
description: Create public HTML mini-sites for structured review, feedback collection, and agent-readable shared JSON state through the Shareable Agent HTML MCP service.
---

# Shareable HTML

Use this skill when a user needs a shareable, browser-native review surface instead of Markdown: migration decisions, checklist feedback, structured approvals, data audits, or one-off internal tools.

## Workflow

1. Build a focused HTML mini-site with clear labels and enough context for reviewers.
2. Call `get_design_system` and use the returned Tailwind CSS Browser + daisyUI no-build UI kit. Do not create a light-mode UI unless explicitly requested.
3. Mark every editable field with a stable `data-field` path.
4. Provide an initial JSON `state` with all expected keys.
5. Set `expiresAt` if the public link should stop working after a deadline.
6. Upload with the `create_document` MCP tool.
7. Give the user the returned public URL.
8. After review, use `get_document_state` to retrieve the shared JSON state.

## Design System

The host injects Tailwind CSS Browser, daisyUI 5, `data-theme="dark"`, and a small host stylesheet for comments/toolbars. Use semantic HTML plus daisyUI component classes:

- `btn`
- `card`
- `table`
- `input`
- `select`
- `textarea`
- `checkbox`
- `radio`
- `toggle`
- `badge`
- `alert`
- `tabs`
- `navbar`
- `stats`
- `modal`
- `collapse`

Use Tailwind utility classes for layout, spacing, responsive grids, and typography. Avoid custom CSS unless the task needs a layout that component classes cannot express.

The host overrides daisyUI's default purple/pink theme with a restrained dark B2B palette. Generated apps should feel like operational review tools: neutral surfaces, tight spacing, clear hierarchy, and restrained status colors. Avoid purple, pink, neon gradients, decorative gradient cards, and generic AI-dashboard visuals.

For interactive pages, the host toolbar already shows the document title, expiry, save status, save action, comment mode, and comment count. Do not add a duplicate top headline, loading indicator, save button, or save-status label inside the agent-built body.

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

## Choices And Comments

Use native radio/select inputs for simple choices. Use visual choice cards for image/design decisions:

```html
<button type="button" data-choice-field="positions.0.selectedIllustration" data-choice-value="illustration-a">
  <img src="assets/illustration-a.png" alt="">
</button>
```

The SDK saves the selected value and adds `is-selected` to the active card.

The SDK also provides a fixed top toolbar for interactive pages with title, expiry, save status, save action, comment mode, and comment count. Any `data-field` or `data-choice-field` can receive comments. For comments on a larger non-input element, add:

```html
<section data-comment-id="homepage-hero">...</section>
```

Comments are saved in `_comments` in shared JSON state.

## MCP Tools

- `get_design_system`: retrieve the no-build UI kit, head tags, starter HTML, and examples.
- `create_document`: upload HTML or a full mini-site.
- `update_document`: edit the HTML, assets, metadata, or state.
- `list_documents`: find existing documents.
- `get_document`: inspect URL, metadata, file list, and current state.
- `get_document_state`: retrieve reviewer input.
- `update_document_state`: overwrite shared state.
- `patch_document_state`: update a few shared state fields.
- `delete_document`: remove a document.

`create_document` and `update_document` accept `expiresAt`. After expiry, public URLs return `410 Gone`, but MCP/API access still works. Set `expiresAt: null` to clear expiry and make the document public again.
