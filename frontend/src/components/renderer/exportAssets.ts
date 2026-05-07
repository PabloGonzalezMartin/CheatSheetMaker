export const EXPORT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
  .hl-method { color: #e74c3c; font-weight: 500; }
  .hl-param { color: #e67e22; }
  .hl-str { color: #27ae60; }
  .export-btn-action { font-size: 0.72rem; padding: 3px 10px; border-radius: 5px; border: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; cursor: pointer; font-weight: 500; font-family: inherit; }
  .export-btn-action:hover { background: #f3f4f6; }
  .export-section-header { transition: opacity 0.15s; }
  .export-section-header:hover { opacity: 0.9; }
  .export-subsection-header:hover { opacity: 0.9; }
  .export-code-line:hover { background-color: #f0f1f3 !important; }
  .export-code-line:hover .export-copy-btn { opacity: 1 !important; }
  .export-copy-btn:hover { background: #e5e7eb !important; }
  .export-copy-btn.copied { opacity: 1 !important; color: #16a34a !important; background: #f0fdf4 !important; border-color: #bbf7d0 !important; }
  .export-index-item:hover { background: #f3f4f6 !important; }
  .export-index-item:hover span:last-child { color: #1d4ed8 !important; }
  .export-text-line p { margin: 4px 0; }
  .export-text-line ul, .export-text-line ol { margin: 8px 0 8px 20px; }
  .export-text-line li { margin: 4px 0; line-height: 1.5; }
  .export-text-line ul { list-style-type: disc; }
  .export-text-line ol { list-style-type: decimal; }
  .export-text-line strong { font-weight: 700; }
  .export-text-line em { font-style: italic; }
  .export-text-line code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 0.88em; color: #c7254e; }
  .export-text-line pre { background: #2d2d2d; color: #f8f8f2; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 0.88rem; margin: 8px 0; }
  .export-text-line pre code { background: none; padding: 0; color: inherit; }
  .export-text-line blockquote { border-left: 4px solid #667eea; margin: 8px 0; padding: 8px 16px; background: rgba(102,126,234,0.05); color: #555; font-style: italic; }
  .export-text-line h1 { font-size: 1.4em; margin: 8px 0 4px; color: #2c3e50; }
  .export-text-line h2 { font-size: 1.2em; margin: 8px 0 4px; color: #2c3e50; }
  .export-text-line h3 { font-size: 1.1em; margin: 8px 0 4px; color: #2c3e50; }
  .export-text-line table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 0.92em; }
  .export-text-line th, .export-text-line td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  .export-text-line th { background: rgba(102,126,234,0.1); font-weight: 600; }
  .export-text-line tr:nth-child(even) { background: rgba(0,0,0,0.02); }
  .export-text-line a { color: #667eea; text-decoration: none; }
  .export-description p { margin: 4px 0; }
  .export-description ul, .export-description ol { margin: 8px 0 8px 20px; }
  .export-description li { margin: 4px 0; line-height: 1.5; }
  .export-description ul { list-style-type: disc; }
  .export-description ol { list-style-type: decimal; }
  .export-description strong { font-weight: 700; }
  .export-description em { font-style: italic; }
  @media print {
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .export-btn-action { display: none !important; }
  }
`;

export const EXPORT_JS = `
  function b64ToUtf8(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function renderMarkdown() {
    document.querySelectorAll('[data-md]').forEach(function(el) {
      var md = b64ToUtf8(el.getAttribute('data-md'));
      el.innerHTML = marked.parse(md);
      el.removeAttribute('data-md');
    });
    if (window.renderMathInElement) {
      document.querySelectorAll('.export-text-line, .export-description').forEach(function(el) {
        renderMathInElement(el, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
          ],
          throwOnError: false
        });
      });
    }
  }
  function toggleSection(header) {
    var content = header.nextElementSibling;
    var icon = header.querySelector('span:last-child');
    var hidden = content.style.display === 'none';
    content.style.display = hidden ? '' : 'none';
    if (icon) icon.textContent = hidden ? '\\u25bc' : '\\u25b6';
  }
  function toggleSubsection(header) {
    var content = header.nextElementSibling;
    var icon = header.querySelector('span:last-child');
    var hidden = content.style.display === 'none';
    content.style.display = hidden ? '' : 'none';
    if (icon) icon.textContent = hidden ? '\\u25bc' : '\\u25b6';
  }
  function toggleIndex(header) {
    var content = header.nextElementSibling;
    var icon = header.querySelector('span:last-child');
    var hidden = content.style.display === 'none';
    content.style.display = hidden ? '' : 'none';
    if (icon) icon.textContent = hidden ? '\\u25bc' : '\\u25b6';
  }
  function expandAll() {
    document.querySelectorAll('.export-section-header').forEach(function(h) {
      var c = h.nextElementSibling; if (c) c.style.display = '';
      var i = h.querySelector('span:last-child'); if (i) i.textContent = '\\u25bc';
    });
    document.querySelectorAll('.export-subsection-header').forEach(function(h) {
      var c = h.nextElementSibling; if (c) c.style.display = '';
      var i = h.querySelector('span:last-child'); if (i) i.textContent = '\\u25bc';
    });
  }
  function collapseAll() {
    document.querySelectorAll('.export-section-header').forEach(function(h) {
      var c = h.nextElementSibling; if (c) c.style.display = 'none';
      var i = h.querySelector('span:last-child'); if (i) i.textContent = '\\u25b6';
    });
    document.querySelectorAll('.export-subsection-header').forEach(function(h) {
      var c = h.nextElementSibling; if (c) c.style.display = 'none';
      var i = h.querySelector('span:last-child'); if (i) i.textContent = '\\u25b6';
    });
  }
  function copyCode(btn) {
    navigator.clipboard.writeText(btn.getAttribute('data-code') || '').then(function() {
      btn.textContent = '\\u2713 copied';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1500);
    });
  }
  document.addEventListener('DOMContentLoaded', function() {
    renderMarkdown();
    document.querySelectorAll('.export-section-header').forEach(function(h) {
      h.addEventListener('click', function() { toggleSection(h); });
    });
    document.querySelectorAll('.export-subsection-header').forEach(function(h) {
      h.addEventListener('click', function() { toggleSubsection(h); });
    });
    document.querySelectorAll('.export-index-header').forEach(function(h) {
      h.addEventListener('click', function() { toggleIndex(h); });
    });
    document.querySelectorAll('.export-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); copyCode(btn); });
    });
    document.querySelectorAll('.export-btn-action').forEach(function(btn) {
      var text = btn.textContent.trim();
      if (text.indexOf('Expand') !== -1) btn.addEventListener('click', expandAll);
      else if (text.indexOf('Collapse') !== -1) btn.addEventListener('click', collapseAll);
      else if (text.indexOf('Print') !== -1) btn.addEventListener('click', function() { window.print(); });
    });
    collapseAll();
  });
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); expandAll(); }
    if (e.ctrlKey && e.key === 'q') { e.preventDefault(); collapseAll(); }
  });
`;
