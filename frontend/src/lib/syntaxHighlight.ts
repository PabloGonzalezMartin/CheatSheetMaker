/**
 * Converts syntax tag format to HTML spans for display in contenteditable.
 * {method:text} → <span class="hl-method">text</span>
 * {param:text}  → <span class="hl-param">text</span>
 * {str:text}    → <span class="hl-str">text</span>
 */
/** Strips syntax tags, leaving just the inner text. {method:head} → head */
export function stripSyntaxTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/\{method:([^}]+)\}/g, "$1")
    .replace(/\{param:([^}]+)\}/g, "$1")
    .replace(/\{str:([^}]+)\}/g, "$1");
}

export function syntaxToHtml(text: string): string {
  if (!text) return "";
  let result = text.replace(/\u200b/g, "");
  result = result.replace(/\{method:([^}]+)\}/g, '<span class="hl-method" data-type="method">$1</span>');
  result = result.replace(/\{param:([^}]+)\}/g, '<span class="hl-param" data-type="param">$1</span>');
  result = result.replace(/\{str:([^}]+)\}/g, '<span class="hl-str" data-type="str">$1</span>');
  result = result.replace(/\n/g, "<br>");
  return result;
}

/**
 * Converts HTML span format back to syntax tags for storage.
 * <span class="hl-method">text</span> → {method:text}
 */
export function htmlToSyntax(html: string): string {
  if (!html) return "";
  let result = html;
  result = result.replace(/<span[^>]*data-type="method"[^>]*>(.*?)<\/span>/g, "{method:$1}");
  result = result.replace(/<span[^>]*data-type="param"[^>]*>(.*?)<\/span>/g, "{param:$1}");
  result = result.replace(/<span[^>]*data-type="str"[^>]*>(.*?)<\/span>/g, "{str:$1}");
  // Convert <br> and block-level divs to newlines
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<\/div><div>/gi, "\n");
  result = result.replace(/<div>/gi, "\n");
  result = result.replace(/<\/div>/gi, "");
  // Strip any remaining HTML tags
  result = result.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  const txt = document.createElement("textarea");
  txt.innerHTML = result;
  // Strip zero-width spaces (used as cursor anchors in empty spans)
  return txt.value.replace(/\u200b/g, "");
}
