export const agentHtmlDesignSystem = String.raw`:root {
  color-scheme: dark;
  --agent-bg: #0b0c0f;
  --agent-surface: #15171c;
  --agent-surface-2: #1d2027;
  --agent-surface-3: #282c34;
  --agent-text: #f2f4f8;
  --agent-muted: #a0a7b3;
  --agent-border: #30343c;
  --agent-border-strong: #4a505b;
  --agent-accent: #66d9a6;
  --agent-accent-2: #79a8ff;
  --agent-danger: #ff7b72;
  --agent-danger-soft: rgba(255, 122, 107, .14);
  --agent-warning: #ffd166;
  --agent-warning-soft: rgba(255, 209, 102, .14);
  --agent-radius: 8px;
  --agent-shadow: 0 14px 44px rgba(0, 0, 0, .32);

  --bg: var(--agent-bg);
  --panel: var(--agent-surface);
  --ink: var(--agent-text);
  --muted: var(--agent-muted);
  --line: var(--agent-border);
  --accent: var(--agent-accent);
  --accent-soft: rgba(102, 217, 166, .14);
  --danger: var(--agent-danger);
  --danger-soft: var(--agent-danger-soft);
  --keep: var(--agent-accent);
  --keep-soft: rgba(102, 217, 166, .12);
  --warn: var(--agent-warning);
  --warn-soft: var(--agent-warning-soft);
}

html {
  background: var(--agent-bg);
}

body {
  background: linear-gradient(180deg, #101216 0%, var(--agent-bg) 260px);
  color: var(--agent-text);
}

a {
  color: var(--agent-accent);
}

button,
input,
select,
textarea {
  color-scheme: dark;
}

input,
select,
textarea {
  background: #0c121b;
  color: var(--agent-text);
  border-color: var(--agent-border);
}

input::placeholder,
textarea::placeholder {
  color: #6f8094;
}

button,
.agent-button {
  background: var(--agent-surface-2);
  color: var(--agent-text);
  border: 1px solid var(--agent-border);
  border-radius: 7px;
}

button:hover,
.agent-button:hover {
  border-color: var(--agent-accent);
}

.agent-button-primary,
button[data-save] {
  background: linear-gradient(180deg, #43bf88, #24996b);
  border-color: #55d69b;
  color: #06110c;
}

.agent-shell {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.agent-topbar,
.topbar {
  background: rgba(12, 13, 16, .94) !important;
  border-bottom: 1px solid var(--agent-border) !important;
  box-shadow: 0 16px 34px rgba(0, 0, 0, .22);
}

.agent-card,
.summary div,
details.category,
.redirects {
  background: linear-gradient(180deg, rgba(29, 32, 39, .96), rgba(21, 23, 28, .96)) !important;
  border: 1px solid var(--agent-border) !important;
  border-radius: var(--agent-radius) !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
}

.agent-card {
  padding: 16px;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.agent-table {
  width: 100%;
  border-collapse: collapse;
}

.agent-table th,
.agent-table td {
  border-bottom: 1px solid var(--agent-border);
  padding: 9px 10px;
  text-align: left;
}

.agent-table th {
  color: var(--agent-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.page-row,
.agent-row {
  background: rgba(15, 16, 20, .84) !important;
  border-color: var(--agent-border) !important;
}

.page-row.is-remove,
.agent-row.is-danger {
  background: rgba(90, 28, 30, .42) !important;
  border-color: rgba(255, 122, 107, .38) !important;
}

.url,
code,
pre {
  color: #9fc4ff !important;
}

.title,
.meta,
.recommendation,
.category-stats,
.summary span {
  color: var(--agent-muted) !important;
}

.badge,
.agent-badge {
  background: var(--agent-warning-soft) !important;
  color: var(--agent-warning) !important;
  border: 1px solid rgba(255, 209, 102, .22);
}

.agent-choice,
[data-choice-field][data-choice-value] {
  background: var(--agent-surface-2);
  border: 1px solid var(--agent-border);
  border-radius: var(--agent-radius);
  color: var(--agent-text);
}

.agent-choice.is-selected,
[data-choice-field][data-choice-value].is-selected {
  outline: 3px solid var(--agent-accent) !important;
  border-color: var(--agent-accent) !important;
  box-shadow: 0 0 0 6px rgba(102, 217, 166, .12);
}

.agent-html-toolbar {
  background: rgba(12, 18, 27, .94) !important;
  border-color: var(--agent-border-strong) !important;
  color: var(--agent-text) !important;
}

.agent-html-toolbar button {
  background: var(--agent-surface-2) !important;
  color: var(--agent-text) !important;
  border-color: var(--agent-border) !important;
}

.agent-html-toolbar button.is-active {
  background: var(--agent-accent) !important;
  border-color: var(--agent-accent) !important;
  color: #06110c !important;
}

.agent-html-comment-popover {
  background: var(--agent-surface) !important;
  border-color: var(--agent-border-strong) !important;
  color: var(--agent-text) !important;
}

.agent-html-comment-item {
  background: #0c121b !important;
  border-color: var(--agent-border) !important;
}

::selection {
  background: rgba(102, 217, 166, .34);
}
`;
