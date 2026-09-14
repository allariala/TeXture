// Message transport between the editor page and its host.
// Hosted in Office (WebView2): JSON objects via chrome.webview. In a plain browser a small mock host
// stands in, so the UI can be developed and tested without Office (see window.__texture).

const webview = window.chrome && window.chrome.webview;
const listeners = new Set();
const officeMode = !webview && new URLSearchParams(location.search).get('platform') === 'office';

export const isHosted = !!webview;

// Web add-in (Mac/Office on the web): the Office.js host is loaded on demand; messages wait until it is up.
let backend = null;
const queued = [];

export function send(message) {
  if (webview) webview.postMessage(message);
  else if (backend) backend.receive(message);
  else queued.push(message);
}

export function onMessage(handler) {
  listeners.add(handler);
}

function dispatch(message) {
  for (const handler of listeners) {
    try { handler(message); } catch (err) { console.error('[texture] handler failed', err); }
  }
}

if (webview) {
  webview.addEventListener('message', (e) => dispatch(e.data));
}

// ---------------------------------------------------------------------------------------------
// Mock host (browser only): persists to localStorage and simulates document selection/inserts.
// ---------------------------------------------------------------------------------------------
const mockHost = (() => {
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('mock.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('mock.' + key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };
  const params = new URLSearchParams(location.search);
  const host = params.get('host') === 'word' ? 'word' : 'ppt';
  const shapes = new Map();
  let seq = 1;

  const defaults = () => ({
    theme: 'auto',
    afterInsert: 'document',
    hotkeys: { pane: 'Alt+Shift+E', popup: 'Alt+Shift+Q', capture: 'Alt+Shift+S' },
    hosts: { ppt: { fontSize: 18, color: '#000000' }, word: { fontSize: 11, color: '#000000' } },
  });

  function deepMerge(target, patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === null) delete target[k];
      else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
      else target[k] = v;
    }
    return target;
  }

  const reply = (msg) => setTimeout(() => dispatch(msg), 15);

  function receive(msg) {
    switch (msg.type) {
      case 'ready':
        reply({
          type: 'init', host, surface: params.get('surface') || 'pane', version: 'dev',
          settings: deepMerge(defaults(), store.get('settings', {})),
          state: store.get('state.' + host, {}),
          snippets: store.get('snippets', null),
          dark: matchMedia('(prefers-color-scheme: dark)').matches,
          server: 'Offline',
        });
        reply({ type: 'selection', equation: null, note: 'Browser preview — no Office host connected' });
        break;
      case 'insert': {
        if (msg.targetKey) shapes.delete(msg.targetKey);
        const key = 'mock|1|' + (seq++);
        const equation = { key, latex: msg.latex, fontSize: msg.fontSize, color: msg.color, legacy: false };
        shapes.set(key, equation);
        window.__texture.lastInsert = msg;
        reply({ type: 'inserted', requestId: msg.requestId, replacedKey: msg.targetKey || null, equation });
        break;
      }
      case 'settings':
        store.set('settings', deepMerge(store.get('settings', {}), msg.patch));
        break;
      case 'state':
        store.set('state.' + host, deepMerge(store.get('state.' + host, {}), msg.patch));
        break;
      case 'snippets.save':
        store.set('snippets', msg.snippets);
        break;
      case 'snippets.export': {
        const blob = new Blob([JSON.stringify({ format: 'texture-snippets', version: 1, snippets: msg.snippets }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'texture-snippets.json';
        a.click();
        break;
      }
      case 'snippets.import': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          try {
            const parsed = JSON.parse(await input.files[0].text());
            const list = Array.isArray(parsed) ? parsed : parsed.snippets;
            store.set('snippets', list);
            dispatch({ type: 'snippets', snippets: list });
          } catch (err) {
            dispatch({ type: 'error', message: 'Import failed: ' + err.message });
          }
        };
        input.click();
        break;
      }
      case 'capture':
        reply({ type: 'status', server: 'Starting...' });
        setTimeout(() => dispatch({ type: 'status', server: 'Idle' }), 600);
        setTimeout(() => dispatch({ type: 'captureResult', latex: 'e^{i\\pi} + 1 = 0' }), 900);
        break;
      default:
        break;
    }
  }

  // Test hooks for driving the UI from the browser console / automation.
  window.__texture = {
    select(equation, note) { dispatch({ type: 'selection', equation: equation || null, note: note || null }); },
    selectShape(key) { dispatch({ type: 'selection', equation: shapes.get(key) || null }); },
    shapes,
    dispatch,
    lastInsert: null,
  };

  return { receive };
})();

function useBackend(b) {
  backend = b;
  while (queued.length) backend.receive(queued.shift());
}

if (officeMode) {
  import('./office-host.js')
    .then((m) => m.createOfficeHost(dispatch))
    .then(useBackend)
    .catch((err) => { console.warn('[texture] Office host unavailable, using the mock host:', err.message); useBackend(mockHost); });
} else if (!webview) {
  useBackend(mockHost);
}
