export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textMatches(text: string, query: string): boolean {
  if (!query.trim() || !text) return false;
  return new RegExp(escapeRegex(query.trim()), "i").test(text);
}

const HIGHLIGHT_STYLE = `
  mark.search-hl {
    background: rgba(255, 213, 0, 0.75);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
    outline: 1px solid rgba(200, 160, 0, 0.5);
  }
  mark.search-hl-first {
    background: rgba(255, 140, 0, 0.85);
    outline: 1px solid rgba(200, 100, 0, 0.7);
  }
`;

/**
 * Injects <mark class="search-hl-editor"> around matching text inside a DOM element.
 * Safe to use in a contenteditable — htmlToSyntax strips <mark> tags.
 * Call with empty query to clear marks.
 */
export function injectEditorMarks(el: HTMLElement, query: string): void {
  el.querySelectorAll("mark.search-hl-editor").forEach((m) => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    }
  });

  if (!query.trim()) return;

  const regex = new RegExp(escapeRegex(query.trim()), "gi");
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentNode as Element | null;
    if (!parent) continue;
    const tag = parent.tagName?.toLowerCase();
    if (tag === "mark" || tag === "script" || tag === "style") continue;

    const text = node.textContent ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const matches = text.match(regex);
    if (!matches) continue;

    const parts = text.split(regex);
    const fragment = document.createDocumentFragment();
    let mIdx = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) fragment.appendChild(document.createTextNode(parts[i]));
      if (mIdx < matches.length) {
        const mark = document.createElement("mark");
        mark.className = "search-hl-editor";
        mark.textContent = matches[mIdx++];
        fragment.appendChild(mark);
      }
    }
    parent.replaceChild(fragment, node);
  }
}

export function applyHighlights(doc: Document, query: string): number {
  doc.querySelectorAll("mark.search-hl").forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(doc.createTextNode(el.textContent ?? ""), el);
      parent.normalize();
    }
  });

  if (!query.trim()) return 0;

  if (!doc.getElementById("search-hl-style")) {
    const style = doc.createElement("style");
    style.id = "search-hl-style";
    style.textContent = HIGHLIGHT_STYLE;
    doc.head?.appendChild(style);
  }

  const regex = new RegExp(escapeRegex(query.trim()), "gi");
  let count = 0;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentNode as Element | null;
    if (!parent) continue;
    const tag = parent.tagName?.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "mark") continue;

    const text = node.textContent ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const matches = text.match(regex);
    if (!matches) continue;

    const parts = text.split(regex);
    const fragment = doc.createDocumentFragment();
    let mIdx = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) fragment.appendChild(doc.createTextNode(parts[i]));
      if (mIdx < matches.length) {
        const mark = doc.createElement("mark");
        mark.className = count === 0 ? "search-hl search-hl-first" : "search-hl";
        mark.textContent = matches[mIdx++];
        fragment.appendChild(mark);
        count++;
      }
    }
    parent.replaceChild(fragment, node);
  }

  return count;
}
