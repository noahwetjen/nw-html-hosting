export const agentHtmlSdk = String.raw`(() => {
  const documentId = location.pathname.match(/^\/d\/([^/]+)/)?.[1];
  if (!documentId) return;

  const endpoint = '/api/public/documents/' + encodeURIComponent(documentId) + '/state';
  let state = {};
  let dirtyFields = {};
  let saveTimer = null;
  let saving = false;

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
    document.dispatchEvent(new CustomEvent('agent-html-state-loaded', { detail: { state } }));
  }

  function setStatus(text) {
    document.querySelectorAll('[data-save-status]').forEach((element) => {
      element.textContent = text;
    });
  }

  async function load() {
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not load document state');
    const payload = await response.json();
    applyState(payload.state || {});
    return state;
  }

  async function save() {
    if (saving) return state;
    saving = true;
    setStatus('Saving...');
    collectState();
    const fields = collectDirtyFields();
    const body = JSON.stringify({ fields });
    try {
      const response = await fetch(endpoint, {
        method: Object.keys(fields).length > 0 ? 'PATCH' : 'PUT',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: Object.keys(fields).length > 0 ? body : JSON.stringify({ state })
      });
      if (!response.ok) throw new Error('Could not save document state');
      const payload = await response.json();
      applyState(payload.state || state);
      setStatus('Saved');
      document.dispatchEvent(new CustomEvent('agent-html-state-saved', { detail: { state } }));
      return state;
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    setStatus('Unsaved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save().catch((error) => {
        console.error(error);
        setStatus('Save failed');
      });
    }, 500);
  }

  window.AgentHtmlState = {
    load,
    save,
    getState: () => structuredClone(state),
    setState: applyState
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
    if (event.target?.closest?.('[data-save]')) {
      event.preventDefault();
      save().catch((error) => {
        console.error(error);
        setStatus('Save failed');
      });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => load().catch(console.error));
  } else {
    load().catch(console.error);
  }
})();`;
