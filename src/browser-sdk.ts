export const agentHtmlSdk = String.raw`(() => {
  const documentId = location.pathname.match(/^\/d\/([^/]+)/)?.[1];
  if (!documentId) return;

  const stateEndpoint = '/api/public/documents/' + encodeURIComponent(documentId) + '/state';
  const metadataEndpoint = '/api/public/documents/' + encodeURIComponent(documentId);
  let state = {};
  let metadata = null;
  let dirtyFields = {};
  let saveTimer = null;
  let saving = false;
  let commentMode = false;
  let activeCommentTarget = null;
  let toolbarResizeObserver = null;

  function parsePath(path) {
    return path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function getNested(object, path) {
    return parsePath(path).reduce((current, key) => current == null ? undefined : current[key], object);
  }

  function setNested(object, path, value) {
    const parts = parsePath(path);
    let current = object;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      const nextKey = parts[index + 1];
      if (current[key] == null || typeof current[key] !== 'object') {
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[key];
    }
    current[parts[parts.length - 1]] = value;
  }

  function readElement(element) {
    if (element.type === 'checkbox') return element.checked;
    if (element.type === 'radio') return element.checked ? element.value : undefined;
    if (element.tagName === 'SELECT' && element.multiple) {
      return Array.from(element.selectedOptions).map((option) => option.value);
    }
    if (element.type === 'number' || element.dataset.type === 'number') {
      return element.value === '' ? null : Number(element.value);
    }
    if (element.dataset.type === 'json') {
      try {
        return element.value === '' ? null : JSON.parse(element.value);
      } catch {
        return element.value;
      }
    }
    return element.value;
  }

  function writeElement(element, value) {
    if (value === undefined) return;
    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
      return;
    }
    if (element.type === 'radio') {
      element.checked = String(value) === element.value;
      return;
    }
    if (element.tagName === 'SELECT' && element.multiple && Array.isArray(value)) {
      Array.from(element.options).forEach((option) => {
        option.selected = value.includes(option.value);
      });
      return;
    }
    element.value = value == null ? '' : String(value);
  }

  function collectState() {
    const nextState = structuredClone(state && typeof state === 'object' ? state : {});
    document.querySelectorAll('[data-field]').forEach((element) => {
      const value = readElement(element);
      if (value !== undefined) setNested(nextState, element.dataset.field, value);
    });
    state = nextState;
    return state;
  }

  function collectDirtyFields() {
    const fields = dirtyFields;
    dirtyFields = {};
    return fields;
  }

  function applyState(nextState) {
    state = nextState && typeof nextState === 'object' ? nextState : {};
    document.querySelectorAll('[data-field]').forEach((element) => {
      writeElement(element, getNested(state, element.dataset.field));
    });
    refreshChoiceControls();
    refreshCommentMarkers();
    refreshToolbar();
    setStatus('Gespeichert');
    document.dispatchEvent(new CustomEvent('agent-html-state-loaded', { detail: { state } }));
  }

  function setStatus(text) {
    document.querySelectorAll('[data-save-status]').forEach((element) => {
      element.textContent = text;
    });
    const toolbarStatus = document.querySelector('[data-agent-toolbar-status]');
    if (toolbarStatus) toolbarStatus.textContent = text;
  }

  async function loadMetadata() {
    const response = await fetch(metadataEndpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json();
    metadata = payload.document || null;
    refreshToolbar();
    return metadata;
  }

  async function load() {
    await loadMetadata().catch(console.error);
    const response = await fetch(stateEndpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not load document state');
    const payload = await response.json();
    applyState(payload.state || {});
    return state;
  }

  async function save() {
    if (saving) return state;
    saving = true;
    setStatus('Speichert...');
    collectState();
    const fields = collectDirtyFields();
    const body = JSON.stringify({ fields });
    try {
      const response = await fetch(stateEndpoint, {
        method: Object.keys(fields).length > 0 ? 'PATCH' : 'PUT',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: Object.keys(fields).length > 0 ? body : JSON.stringify({ state })
      });
      if (!response.ok) throw new Error('Could not save document state');
      const payload = await response.json();
      applyState(payload.state || state);
      setStatus('Gespeichert');
      document.dispatchEvent(new CustomEvent('agent-html-state-saved', { detail: { state } }));
      return state;
    } finally {
      saving = false;
    }
  }

  function markDirty(path, value) {
    dirtyFields[path] = value;
    setNested(state, path, value);
    scheduleSave();
  }

  function scheduleSave() {
    setStatus('Ungespeichert');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save().catch((error) => {
        console.error(error);
        setStatus('Speichern fehlgeschlagen');
      });
    }, 500);
  }

  function setupToolbar() {
    if (document.body.dataset.agentToolbar === 'off' || document.querySelector('.agent-html-toolbar')) return;
    if (!hasInteractiveElements()) return;
    injectToolbarStyles();
    const toolbar = document.createElement('header');
    toolbar.className = 'agent-html-toolbar';
    toolbar.innerHTML = [
      '<div class="agent-html-toolbar-main">',
      '<strong data-agent-toolbar-title>Document</strong>',
      '<span data-agent-toolbar-expiry></span>',
      '</div>',
      '<div class="agent-html-toolbar-actions">',
      '<span data-agent-toolbar-status>Bereit</span>',
      '<button type="button" data-agent-save>Speichern</button>',
      '<button type="button" data-agent-comment-mode>Kommentieren</button>',
      '<span data-agent-comment-count>0 Kommentare</span>',
      '</div>'
    ].join('');
    document.body.prepend(toolbar);
    document.body.classList.add('agent-html-has-toolbar');
    syncToolbarOffset();
    toolbarResizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncToolbarOffset) : null;
    toolbarResizeObserver?.observe(toolbar);
    window.addEventListener('resize', syncToolbarOffset);
    toolbar.querySelector('[data-agent-save]').addEventListener('click', () => {
      save().catch((error) => {
        console.error(error);
        setStatus('Speichern fehlgeschlagen');
      });
    });
    toolbar.querySelector('[data-agent-comment-mode]').addEventListener('click', () => {
      setCommentMode(!commentMode);
    });
  }

  function hasInteractiveElements() {
    return Boolean(document.querySelector('[data-field], [data-choice-field], [data-comment-id]'));
  }

  function syncToolbarOffset() {
    const toolbar = document.querySelector('.agent-html-toolbar');
    if (!toolbar) return;
    document.documentElement.style.setProperty('--agent-toolbar-height', Math.ceil(toolbar.getBoundingClientRect().height) + 'px');
  }

  function refreshToolbar() {
    const title = document.querySelector('[data-agent-toolbar-title]');
    const expiry = document.querySelector('[data-agent-toolbar-expiry]');
    const count = document.querySelector('[data-agent-comment-count]');
    const button = document.querySelector('[data-agent-comment-mode]');
    if (title) title.textContent = metadata?.title || document.title || 'Document';
    if (expiry) {
      expiry.textContent = metadata?.expiresAt
        ? 'Ablauf ' + new Date(metadata.expiresAt).toLocaleString()
        : 'Kein Ablauf';
    }
    if (count) {
      const comments = getAllComments();
      count.textContent = comments.length + (comments.length === 1 ? ' Kommentar' : ' Kommentare');
    }
    if (button) button.classList.toggle('is-active', commentMode);
  }

  function setCommentMode(enabled) {
    commentMode = enabled;
    document.body.classList.toggle('agent-html-comment-mode', enabled);
    refreshCommentMarkers();
    refreshToolbar();
  }

  function commentKeyFor(element) {
    const target = element.closest('[data-comment-id], [data-agent-auto-comment-id], [data-field], [data-choice-field]');
    if (!target) return null;
    return target.dataset.commentId || target.dataset.agentAutoCommentId || target.dataset.field || target.dataset.choiceField;
  }

  function commentsPath(key) {
    return '_comments.' + encodeURIComponent(key);
  }

  function getComments(key) {
    const comments = getNested(state, commentsPath(key));
    return Array.isArray(comments) ? comments : [];
  }

  function getAllComments() {
    const container = state && typeof state === 'object' ? state._comments : null;
    if (!container || typeof container !== 'object') return [];
    return Object.values(container).flatMap((value) => Array.isArray(value) ? value : []);
  }

  function saveComments(key, comments) {
    markDirty(commentsPath(key), comments);
    refreshCommentMarkers();
    refreshToolbar();
  }

  function refreshCommentMarkers() {
    document.querySelectorAll('.agent-html-comment-target').forEach((element) => {
      element.classList.remove('agent-html-comment-target', 'agent-html-has-comments');
    });
    ensureAutoCommentTargets();
    document.querySelectorAll('[data-comment-id], [data-agent-auto-comment-id], [data-field], [data-choice-field]').forEach((element) => {
      const key = commentKeyFor(element);
      if (!key) return;
      element.classList.add('agent-html-comment-target');
      element.classList.toggle('agent-html-has-comments', getComments(key).length > 0);
    });
  }

  function ensureAutoCommentTargets() {
    const selector = 'main article, main section, main tr, main li, main [role="row"], main .card, main .stat, main .alert';
    document.querySelectorAll(selector).forEach((element, index) => {
      if (
        element.dataset.commentId ||
        element.dataset.agentAutoCommentId ||
        element.closest('.agent-html-toolbar, .agent-html-comment-popover')
      ) {
        return;
      }
      const label = compactText(element.textContent).slice(0, 48);
      element.dataset.agentAutoCommentId = 'auto:' + element.tagName.toLowerCase() + ':' + index + ':' + label;
    });
  }

  function openCommentPopover(element) {
    const key = commentKeyFor(element);
    if (!key) return;
    activeCommentTarget = key;
    closeCommentPopover();
    const popover = document.createElement('div');
    popover.className = 'agent-html-comment-popover';
    popover.dataset.commentPopover = key;
    renderCommentPopover(popover, key);
    document.body.appendChild(popover);
    const rect = element.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 280, Math.max(12, rect.bottom + 8));
    const left = Math.min(window.innerWidth - 340, Math.max(12, rect.left));
    popover.style.top = top + 'px';
    popover.style.left = left + 'px';
  }

  function closeCommentPopover() {
    document.querySelectorAll('.agent-html-comment-popover').forEach((element) => element.remove());
  }

  function renderCommentPopover(popover, key) {
    const comments = getComments(key);
    popover.innerHTML = [
      '<div class="agent-html-comment-head">',
      '<strong>Kommentar</strong>',
      '<button type="button" data-comment-close>×</button>',
      '</div>',
      '<div class="agent-html-comment-list">',
      comments.length === 0 ? '<p>Noch keine Kommentare.</p>' : comments.map((comment) => (
        '<div class="agent-html-comment-item" data-comment-id="' + comment.id + '">' +
        '<textarea data-comment-edit>' + escapeTextarea(comment.text || '') + '</textarea>' +
        '<div><button type="button" data-comment-update>Aktualisieren</button><button type="button" data-comment-delete>Löschen</button></div>' +
        '</div>'
      )).join(''),
      '</div>',
      '<textarea data-comment-new placeholder="Kommentar hinzufügen"></textarea>',
      '<button type="button" data-comment-add>Kommentar speichern</button>'
    ].join('');
    popover.querySelector('[data-comment-close]').addEventListener('click', closeCommentPopover);
    popover.querySelector('[data-comment-add]').addEventListener('click', () => {
      const textarea = popover.querySelector('[data-comment-new]');
      const text = textarea.value.trim();
      if (!text) return;
      const next = getComments(key).concat([{ id: createId(), text, createdAt: new Date().toISOString() }]);
      saveComments(key, next);
      renderCommentPopover(popover, key);
    });
    popover.querySelectorAll('[data-comment-update]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-comment-id]');
        const text = item.querySelector('[data-comment-edit]').value.trim();
        const next = getComments(key).map((comment) => comment.id === item.dataset.commentId
          ? { ...comment, text, updatedAt: new Date().toISOString() }
          : comment);
        saveComments(key, next);
        renderCommentPopover(popover, key);
      });
    });
    popover.querySelectorAll('[data-comment-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-comment-id]');
        const next = getComments(key).filter((comment) => comment.id !== item.dataset.commentId);
        saveComments(key, next);
        renderCommentPopover(popover, key);
      });
    });
  }

  function createId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function escapeTextarea(value) {
    return String(value).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  }

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function refreshChoiceControls() {
    document.querySelectorAll('[data-choice-field][data-choice-value]').forEach((element) => {
      const active = String(getNested(state, element.dataset.choiceField)) === String(element.dataset.choiceValue);
      element.classList.toggle('is-selected', active);
      element.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function handleChoiceClick(element) {
    const field = element.dataset.choiceField;
    const value = element.dataset.choiceValue;
    if (!field) return;
    markDirty(field, value);
    refreshChoiceControls();
  }

  function injectToolbarStyles() {
    if (document.querySelector('[data-agent-html-sdk-styles]')) return;
    const style = document.createElement('style');
    style.dataset.agentHtmlSdkStyles = 'true';
    style.textContent = [
      '.agent-html-comment-target{position:relative}',
      '.agent-html-comment-target.agent-html-has-comments{outline:2px solid color-mix(in oklab,var(--color-primary,#60a5fa) 55%,transparent);outline-offset:2px}',
      '.agent-html-comment-target.agent-html-has-comments::after{content:"";position:absolute;right:-5px;top:-5px;width:10px;height:10px;border-radius:999px;background:var(--color-primary,#60a5fa);box-shadow:0 0 0 2px var(--color-base-100,#111827)}',
      '.agent-html-comment-mode .agent-html-comment-target{cursor:copy;outline:1px dashed color-mix(in oklab,var(--color-primary,#60a5fa) 38%,transparent);outline-offset:3px}',
      '.agent-html-comment-mode .agent-html-comment-target:hover{outline:2px solid var(--color-primary,#60a5fa);box-shadow:0 0 0 4px color-mix(in oklab,var(--color-primary,#60a5fa) 16%,transparent)}',
      '.agent-html-comment-popover{position:fixed;z-index:2147483001;width:min(320px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));overflow:auto;font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.agent-html-comment-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
      '.agent-html-comment-head button{border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer}',
      '.agent-html-comment-list{display:grid;gap:8px;margin-bottom:8px}',
      '.agent-html-comment-list p{margin:0;color:color-mix(in oklab,var(--color-base-content,#e5e7eb) 64%,transparent)}',
      '.agent-html-comment-item{display:grid;gap:6px}',
      '.agent-html-comment-item div{display:flex;gap:6px;justify-content:flex-end}',
      '.agent-html-comment-popover textarea{width:100%;min-height:54px;resize:vertical;border:1px solid color-mix(in oklab,var(--color-base-content,#e5e7eb) 18%,transparent);border-radius:8px;background:var(--color-base-200,#1f2937);color:var(--color-base-content,#e5e7eb);padding:7px;font:inherit}',
      '.agent-html-comment-popover button{border:1px solid color-mix(in oklab,var(--color-base-content,#e5e7eb) 18%,transparent);border-radius:8px;background:var(--color-base-200,#1f2937);color:var(--color-base-content,#e5e7eb);padding:5px 7px;cursor:pointer}',
      '[data-choice-field][data-choice-value]{cursor:pointer}',
      '[data-choice-field][data-choice-value].is-selected{outline:3px solid var(--color-primary,#60a5fa);outline-offset:2px}'
    ].join('');
    document.head.appendChild(style);
  }

  window.AgentHtmlState = {
    load,
    save,
    getState: () => structuredClone(state),
    setState: applyState,
    getMetadata: () => metadata ? structuredClone(metadata) : null
  };

  document.addEventListener('input', (event) => {
    if (event.target?.matches?.('[data-field]')) {
      dirtyFields[event.target.dataset.field] = readElement(event.target);
      scheduleSave();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target?.matches?.('[data-field]')) {
      dirtyFields[event.target.dataset.field] = readElement(event.target);
      scheduleSave();
    }
  });

  document.addEventListener('click', (event) => {
    const commentTarget = event.target?.closest?.('[data-comment-id], [data-agent-auto-comment-id], [data-field], [data-choice-field]');
    if (commentMode && commentTarget && !event.target?.closest?.('.agent-html-toolbar, .agent-html-comment-popover')) {
      event.preventDefault();
      event.stopPropagation();
      openCommentPopover(commentTarget);
      return;
    }
    const choice = event.target?.closest?.('[data-choice-field][data-choice-value]');
    if (choice) {
      event.preventDefault();
      handleChoiceClick(choice);
      return;
    }
    if (event.target?.closest?.('[data-save]')) {
      event.preventDefault();
      save().catch((error) => {
        console.error(error);
        setStatus('Speichern fehlgeschlagen');
      });
    }
  });

  document.addEventListener('mouseover', (event) => {
    const target = event.target?.closest?.('.agent-html-has-comments');
    if (!target || commentMode || document.querySelector('.agent-html-comment-popover')) return;
    openCommentPopover(target);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCommentPopover();
      setCommentMode(false);
    }
  });

  function start() {
    setupToolbar();
    load().catch((error) => {
      console.error(error);
      setStatus('Laden fehlgeschlagen');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();`;
