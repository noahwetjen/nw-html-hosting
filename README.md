# Shareable Agent HTML

Public, shareable HTML mini-sites for agents. The service hosts agent-created HTML/CSS/JS/images at random public URLs and keeps a shared JSON state for interactive fields.

Target domain for production: `https://docs.wetjen.consulting`

## What It Does

- Hosts public documents at `/d/:id`.
- Supports whole mini-sites: `index.html`, CSS, JS, images, and other static assets.
- Stores one shared JSON state per document, similar to a public editable Google Doc link.
- Auto-saves form fields marked with `data-field`.
- Exposes admin operations through a simple API and a remote Streamable HTTP MCP endpoint at `/mcp`.
- Uses API-key auth for agent/admin operations.
- Allows public read and public state writes for anyone with the document URL.

## Railway Setup

1. Create a Railway project from this repository.
2. Add a Railway Postgres database.
3. Set these variables on the app service:

```sh
PUBLIC_BASE_URL=https://docs.wetjen.consulting
HTML_HOSTING_API_KEY=<long random secret>
DATABASE_URL=<Railway Postgres DATABASE_URL>
NODE_ENV=production
```

4. Add the custom domain `docs.wetjen.consulting` to the Railway service.
5. Point the DNS record for `docs.wetjen.consulting` to Railway as instructed by Railway.

The app runs migrations automatically on startup.

## Local Development

```sh
npm install
cp .env.example .env
docker compose up -d
npm run dev
```

Then open `http://localhost:3000/healthz`.

## API

Use either header:

```http
Authorization: Bearer <HTML_HOSTING_API_KEY>
```

or:

```http
x-api-key: <HTML_HOSTING_API_KEY>
```

### Create a Single HTML Document

```sh
curl -X POST http://localhost:3000/api/documents \
  -H "authorization: Bearer $HTML_HOSTING_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Migration Review",
    "html": "<!doctype html><html><body><label><input type=\"checkbox\" data-field=\"done\"> Done</label></body></html>",
    "expiresAt": "2026-07-17T12:00:00.000Z",
    "state": { "done": false }
  }'
```

### Create a Mini-Site

```json
{
  "title": "Website Migration Review",
  "entryPath": "index.html",
  "expiresAt": "2026-07-17T12:00:00.000Z",
  "files": [
    {
      "path": "index.html",
      "content": "<!doctype html><html><head><link rel=\"stylesheet\" href=\"styles.css\"></head><body><textarea data-field=\"notes\"></textarea><img src=\"assets/screenshot.png\"></body></html>"
    },
    {
      "path": "styles.css",
      "content": "body { font-family: system-ui, sans-serif; }"
    },
    {
      "path": "assets/screenshot.png",
      "encoding": "base64",
      "mimeType": "image/png",
      "content": "<base64 image bytes>"
    }
  ],
  "state": {
    "notes": ""
  }
}
```

### Expiry

Documents can have an optional `expiresAt` ISO timestamp.

- Before `expiresAt`, public URLs and public state writes work normally.
- After `expiresAt`, `/d/:id`, `/d/:id/...`, and `/api/public/documents/:id/state` return `410 Gone`.
- The document, assets, and state are not deleted.
- API and MCP tools with `HTML_HOSTING_API_KEY` can still list, read, update, and retrieve state.
- Set `expiresAt: null` with `PUT /api/documents/:id` or `update_document` to make a document public again.

### Endpoints

- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `GET /api/documents/:id/state`
- `PUT /api/documents/:id/state`
- `PATCH /api/documents/:id/state`

Public state endpoints used by hosted pages:

- `GET /api/public/documents/:id/state`
- `PUT /api/public/documents/:id/state`
- `PATCH /api/public/documents/:id/state`

## Interactive HTML Convention

Any field with `data-field` is synced to the shared JSON state.

```html
<input type="checkbox" data-field="pages.0.remove">
<select data-field="pages.0.decision">
  <option value="keep">Keep</option>
  <option value="remove">Remove</option>
  <option value="merge">Merge</option>
</select>
<textarea data-field="pages.0.notes"></textarea>
<button data-save>Save</button>
<span data-save-status></span>
```

The server injects `/agent-html-sdk.js` into HTML pages automatically. Agents may also include it explicitly:

```html
<script src="/agent-html-sdk.js" defer></script>
```

The SDK exposes:

```js
window.AgentHtmlState.load()
window.AgentHtmlState.save()
window.AgentHtmlState.getState()
window.AgentHtmlState.setState(nextState)
```

### Custom JavaScript

Hosted documents may include their own JavaScript for page-specific behavior:

```html
<script src="app.js" defer></script>
```

Custom JavaScript should use the standard state surface instead of writing directly to the public state API:

```js
document.addEventListener('agent-html-state-loaded', (event) => {
  console.log('Current shared state:', event.detail.state);
});

document.addEventListener('agent-html-state-saved', (event) => {
  console.log('Saved shared state:', event.detail.state);
});

async function markReviewed() {
  const state = window.AgentHtmlState.getState();
  state.reviewed = true;
  window.AgentHtmlState.setState(state);
  await window.AgentHtmlState.save();
}
```

Rules for custom JavaScript:

- Use `data-field` for persisted reviewer input.
- Use local JavaScript for UI behavior, filtering, sorting, derived displays, charts, and validation.
- Do not embed secrets, API keys, private tokens, or non-public data.
- Do not depend on cookies or login state.
- Keep external third-party scripts minimal; uploaded local JS is preferred.

### Choices And Comments

For “choose one of several options” interfaces, use either native radio controls:

```html
<label><input type="radio" name="hero" value="variant-a" data-field="hero.choice"> Variant A</label>
<label><input type="radio" name="hero" value="variant-b" data-field="hero.choice"> Variant B</label>
```

Or use visual choice cards:

```html
<button type="button" data-choice-field="hero.choice" data-choice-value="variant-a">
  <img src="assets/hero-a.png" alt="">
</button>
<button type="button" data-choice-field="hero.choice" data-choice-value="variant-b">
  <img src="assets/hero-b.png" alt="">
</button>
```

The SDK marks the selected card with `is-selected` and saves the selected value to JSON.

The SDK also adds a sticky document toolbar. It shows the document title, expiry status, save status, and comment count. Any element with `data-field`, `data-choice-field`, or explicit `data-comment-id` can receive comments. Comments are stored in shared state under `_comments`.

```html
<section data-comment-id="hero-illustration-decision">
  ...
</section>
```

## MCP

Remote Streamable HTTP MCP endpoint:

```text
https://docs.wetjen.consulting/mcp
```

Required header:

```http
Authorization: Bearer <HTML_HOSTING_API_KEY>
```

Tools:

- `list_documents`
- `create_document`
- `get_document`
- `update_document`
- `delete_document`
- `get_document_state`
- `update_document_state`
- `patch_document_state`

`create_document` and `update_document` accept `expiresAt`. Use an ISO timestamp to expire public access, or `null` to clear expiry.

Example remote MCP config for clients that support Streamable HTTP:

```json
{
  "mcpServers": {
    "shareable-agent-html": {
      "url": "https://docs.wetjen.consulting/mcp",
      "headers": {
        "Authorization": "Bearer ${HTML_HOSTING_API_KEY}"
      }
    }
  }
}
```

## Security Notes

- Public document URLs are bearer links: anyone with the URL can view and edit the shared state.
- Admin/API operations require `HTML_HOSTING_API_KEY`.
- The API key is never sent to browser pages.
- Hosted HTML may run JavaScript. This is intentionally flexible for agent-created mini-tools, but those pages should be treated like public pages and should not contain secrets.
- Use a dedicated subdomain like `docs.wetjen.consulting` so arbitrary document JavaScript is isolated from other apps.
