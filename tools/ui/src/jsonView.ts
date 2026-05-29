/**
 * JSON result view: collapsible tree and pretty-printed text.
 */

const JSON_REPLACER = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString() : v;

function safeJsonCopy(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value, JSON_REPLACER));
  } catch {
    return { _error: 'Value could not be serialized as JSON', _toString: String(value) };
  }
}

type Mode = 'tree' | 'pretty';

function bytesPreview(u8: Uint8Array, max = 48): string {
  const n = u8.length;
  const chunk = n <= max ? u8 : u8.subarray(0, max);
  const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
  return n > max ? `0x${hex} … (+${n - max} bytes)` : `0x${hex}`;
}

function createToolbar(
  onMode: (m: Mode) => void
): { el: HTMLDivElement; setMode: (m: Mode) => void } {
  const el = document.createElement('div');
  el.className = 'json-view-toolbar';
  const treeBtn = document.createElement('button');
  treeBtn.type = 'button';
  treeBtn.className = 'json-view-mode active';
  treeBtn.textContent = 'Tree';
  treeBtn.setAttribute('aria-pressed', 'true');
  const prettyBtn = document.createElement('button');
  prettyBtn.type = 'button';
  prettyBtn.className = 'json-view-mode';
  prettyBtn.textContent = 'Formatted';
  prettyBtn.setAttribute('aria-pressed', 'false');

  function setMode(m: Mode) {
    const tree = m === 'tree';
    treeBtn.classList.toggle('active', tree);
    prettyBtn.classList.toggle('active', !tree);
    treeBtn.setAttribute('aria-pressed', tree ? 'true' : 'false');
    prettyBtn.setAttribute('aria-pressed', tree ? 'false' : 'true');
    onMode(m);
  }
  treeBtn.addEventListener('click', () => setMode('tree'));
  prettyBtn.addEventListener('click', () => setMode('pretty'));
  el.appendChild(treeBtn);
  el.appendChild(prettyBtn);
  return { el, setMode };
}

function renderTreeNode(
  parent: HTMLElement,
  value: unknown,
  key: string | null,
  depth: number
): void {
  const line = document.createElement('div');
  line.className = 'json-tree-line';
  line.style.setProperty('--json-depth', String(depth));

  if (value === null) {
    line.appendChild(keyPrefix(key));
    const span = document.createElement('span');
    span.className = 'json-t-null';
    span.textContent = 'null';
    line.appendChild(span);
    parent.appendChild(line);
    return;
  }

  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
    line.appendChild(keyPrefix(key));
    line.appendChild(primitiveSpan(value as string | number | boolean | bigint));
    parent.appendChild(line);
    return;
  }

  if (t !== 'object') {
    line.appendChild(keyPrefix(key));
    const span = document.createElement('span');
    span.className = 'json-t-other';
    span.textContent = String(value);
    line.appendChild(span);
    parent.appendChild(line);
    return;
  }

  if (Array.isArray(value)) {
    const header = document.createElement('div');
    header.className = 'json-tree-header';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'json-tree-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = '▼';
    header.appendChild(toggle);
    if (key !== null) {
      const k = document.createElement('span');
      k.className = 'json-t-key';
      k.textContent = key;
      header.appendChild(k);
      const colon = document.createElement('span');
      colon.className = 'json-t-punct';
      colon.textContent = ': ';
      header.appendChild(colon);
    }
    const brack = document.createElement('span');
    brack.className = 'json-t-punct';
    const n = value.length;
    brack.textContent = `[${n} ${n === 1 ? 'item' : 'items'}]`;
    header.appendChild(brack);
    line.appendChild(header);
    const children = document.createElement('div');
    children.className = 'json-tree-children';
    for (let i = 0; i < value.length; i++) {
      renderTreeNode(children, value[i], String(i), depth + 1);
    }
    line.appendChild(children);
    parent.appendChild(line);
    wireToggle(toggle, children, header, n > 0);
    return;
  }

  if (value instanceof Uint8Array) {
    line.appendChild(keyPrefix(key));
    const s = document.createElement('span');
    s.className = 'json-t-bytes';
    s.textContent = `Uint8Array(${value.length} bytes) ${bytesPreview(value)}`;
    line.appendChild(s);
    parent.appendChild(line);
    return;
  }

  {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(value as object);
    const header = document.createElement('div');
    header.className = 'json-tree-header';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'json-tree-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = '▼';
    header.appendChild(toggle);
    if (key !== null) {
      const k = document.createElement('span');
      k.className = 'json-t-key';
      k.textContent = key;
      header.appendChild(k);
      const colon = document.createElement('span');
      colon.className = 'json-t-punct';
      colon.textContent = ': ';
      header.appendChild(colon);
    }
    const brack = document.createElement('span');
    brack.className = 'json-t-punct';
    brack.textContent = `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`;
    header.appendChild(brack);
    line.appendChild(header);
    const children = document.createElement('div');
    children.className = 'json-tree-children';
    for (const k of keys) {
      renderTreeNode(children, obj[k], k, depth + 1);
    }
    line.appendChild(children);
    parent.appendChild(line);
    wireToggle(toggle, children, header, keys.length > 0);
  }
}

function wireToggle(
  toggle: HTMLButtonElement,
  children: HTMLElement,
  header: HTMLElement,
  hasContent: boolean
) {
  if (!hasContent) {
    toggle.style.visibility = 'hidden';
    toggle.setAttribute('aria-hidden', 'true');
    return;
  }
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = children.classList.toggle('json-tree-children--collapsed') === false;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? '▼' : '▶';
  });
  header.addEventListener('click', (e) => {
    if ((e.target as Node) === toggle) return;
    toggle.click();
  });
  header.classList.add('json-tree-header--clickable');
}

function keyPrefix(key: string | null): HTMLSpanElement {
  const wrap = document.createElement('span');
  if (key !== null) {
    const k = document.createElement('span');
    k.className = 'json-t-key';
    k.textContent = key;
    wrap.appendChild(k);
    const colon = document.createElement('span');
    colon.className = 'json-t-punct';
    colon.textContent = ': ';
    wrap.appendChild(colon);
  }
  return wrap;
}

function primitiveSpan(v: string | number | boolean | bigint): HTMLSpanElement {
  const s = document.createElement('span');
  if (typeof v === 'string') {
    s.className = 'json-t-string';
    s.textContent = JSON.stringify(v);
  } else if (typeof v === 'boolean') {
    s.className = 'json-t-boolean';
    s.textContent = v ? 'true' : 'false';
  } else {
    s.className = 'json-t-number';
    s.textContent = String(v);
  }
  return s;
}

/**
 * Fills a `.json-result` container with tree + pretty views and a mode switcher.
 */
export function mountJsonView(jsonContainer: HTMLDivElement, rawValue: unknown): void {
  jsonContainer.textContent = '';
  jsonContainer.classList.add('json-result--enhanced');

  const normalized = safeJsonCopy(rawValue);

  const treeHost = document.createElement('div');
  treeHost.className = 'json-view-panel json-view-tree';
  const prettyHost = document.createElement('div');
  prettyHost.className = 'json-view-panel json-view-pretty';
  const pre = document.createElement('pre');
  pre.className = 'json-pretty-body';
  try {
    pre.textContent = JSON.stringify(normalized, null, 2);
  } catch {
    pre.textContent = String(rawValue);
  }
  prettyHost.appendChild(pre);

  function showMode(m: Mode) {
    treeHost.style.display = m === 'tree' ? 'block' : 'none';
    prettyHost.style.display = m === 'pretty' ? 'block' : 'none';
  }

  const { el: toolbar, setMode } = createToolbar((m) => showMode(m));

  const treeRoot = document.createElement('div');
  treeRoot.className = 'json-tree-root';
  renderTreeNode(treeRoot, normalized, null, 0);
  treeHost.appendChild(treeRoot);

  jsonContainer.appendChild(toolbar);
  jsonContainer.appendChild(treeHost);
  jsonContainer.appendChild(prettyHost);
  setMode('tree');
}
