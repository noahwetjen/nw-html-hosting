export const designSystemName = 'Tailwind CSS Browser + daisyUI 5';

export const designSystemHeadTags = [
  '<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" data-agent-design-system="daisyui">',
  '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" data-agent-design-system="tailwind"></script>',
  '<link rel="stylesheet" href="/agent-html-host.css" data-agent-host-ui>'
].join('\n');

export const agentHtmlHostCss = String.raw`:root {
  color-scheme: dark;
}

html[data-theme="dark"] {
  color-scheme: dark;
}

body {
  min-height: 100vh;
}

/* Host chrome for shared comments/toolbars. Product UI should use daisyUI + Tailwind classes. */
.agent-html-toolbar {
  position: fixed;
  left: 50%;
  bottom: 16px;
  z-index: 9999;
  display: flex;
  max-width: calc(100vw - 24px);
  transform: translateX(-50%);
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in oklab, var(--color-base-content) 16%, transparent);
  border-radius: 12px;
  background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
  color: var(--color-base-content);
  box-shadow: 0 18px 48px rgb(0 0 0 / .35);
  padding: 8px;
  backdrop-filter: blur(16px);
}

.agent-html-toolbar button {
  min-height: 2rem;
  border: 1px solid color-mix(in oklab, var(--color-base-content) 16%, transparent);
  border-radius: 8px;
  background: var(--color-base-200);
  color: var(--color-base-content);
  padding: 0 10px;
  font: inherit;
}

.agent-html-toolbar button.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-content);
}

.agent-html-comment-popover {
  z-index: 10000;
  border: 1px solid color-mix(in oklab, var(--color-base-content) 16%, transparent);
  border-radius: 12px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  box-shadow: 0 18px 48px rgb(0 0 0 / .35);
  padding: 12px;
}

.agent-html-comment-item {
  border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
  border-radius: 10px;
  background: var(--color-base-200);
  padding: 10px;
}
`;

export const designSystemGuide = {
  name: designSystemName,
  intent: 'Use a validated no-build UI stack for shareable agent HTML apps. Do not invent a custom visual system.',
  headTags: designSystemHeadTags,
  theme: {
    requiredHtmlAttribute: 'data-theme="dark"',
    default: 'dark',
    note: 'Keep review apps dark unless the user explicitly asks otherwise.'
  },
  rules: [
    'Use daisyUI component classes first: btn, card, table, input, select, textarea, checkbox, radio, toggle, badge, alert, tabs, navbar, stats, modal, collapse.',
    'Use Tailwind utility classes for layout, spacing, responsive grids, typography, and small adjustments.',
    'Do not write a separate design system in custom CSS. Only add minimal task-specific CSS when component classes cannot express the layout.',
    'Keep the first screen as the actual tool, not a marketing page.',
    'Every editable decision, note, checkbox, radio, select, textarea, or input still needs a stable data-field path.'
  ],
  starterHtml: `<!doctype html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Review Tool</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen bg-base-200 text-base-content">
  <main class="mx-auto max-w-7xl p-4 md:p-6">
    <header class="navbar mb-4 rounded-box bg-base-100 shadow-sm">
      <div class="flex-1">
        <h1 class="text-xl font-semibold">Review Tool</h1>
      </div>
      <div class="badge badge-primary">Live State</div>
    </header>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h2 class="card-title">Eintrag</h2>
          <p class="text-sm opacity-70">Kontext fuer die Entscheidung.</p>
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" class="checkbox checkbox-primary" data-field="items.0.approved">
            <span class="label-text">Freigeben</span>
          </label>
          <textarea class="textarea textarea-bordered w-full" data-field="items.0.note" placeholder="Notiz"></textarea>
        </div>
      </article>
    </section>
  </main>
</body>
</html>`,
  examples: {
    decisionCard: `<article class="card bg-base-100 shadow-sm">
  <div class="card-body gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="card-title">/alte-seite</h2>
        <p class="text-sm opacity-70">Veraltete Landingpage mit unklarer Migration.</p>
      </div>
      <span class="badge badge-warning">Pruefen</span>
    </div>
    <select class="select select-bordered w-full" data-field="pages.0.decision">
      <option value="">Bitte waehlen</option>
      <option value="keep">Behalten</option>
      <option value="remove">Entfernen</option>
      <option value="merge">Konsolidieren</option>
    </select>
    <textarea class="textarea textarea-bordered w-full" data-field="pages.0.note" placeholder="Begruendung"></textarea>
  </div>
</article>`,
    choiceGrid: `<div class="grid gap-3 md:grid-cols-3">
  <label class="card cursor-pointer bg-base-100 shadow-sm has-[:checked]:outline has-[:checked]:outline-2 has-[:checked]:outline-primary">
    <div class="card-body">
      <input type="radio" class="radio radio-primary" name="hero-choice" value="illustration-a" data-field="sections.hero.choice">
      <h3 class="font-semibold">Illustration A</h3>
      <p class="text-sm opacity-70">Sachlich, ruhig, B2B.</p>
    </div>
  </label>
</div>`,
    tableReview: `<div class="overflow-x-auto rounded-box bg-base-100 shadow-sm">
  <table class="table table-zebra">
    <thead><tr><th>URL</th><th>Status</th><th>Entscheidung</th></tr></thead>
    <tbody>
      <tr>
        <td class="font-mono text-sm">/leistungen</td>
        <td><span class="badge badge-info">Aktuell</span></td>
        <td><input class="checkbox checkbox-primary" type="checkbox" data-field="pages.0.keep"></td>
      </tr>
    </tbody>
  </table>
</div>`
  },
  references: [
    'https://daisyui.com/docs/cdn/',
    'https://daisyui.com/components/',
    'https://tailwindcss.com/docs/installation/play-cdn'
  ]
};
