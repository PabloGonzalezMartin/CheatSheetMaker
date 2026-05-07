"""
Text processing module for CheetSheetMaker.
Renders markdown (via mistune) and LaTeX (via latex2mathml) for text lines.
"""

import re
import mistune
import latex2mathml.converter

_md = mistune.create_markdown(renderer="html", plugins=["table", "strikethrough", "url", "task_lists"])


def process_text_content(text: str) -> str:
    """Render a text line: extract LaTeX placeholders, convert markdown with mistune,
    restore LaTeX as MathML."""
    if not text or not isinstance(text, str) or not text.strip():
        return text or ""

    latex_map: dict[str, tuple[str, bool]] = {}
    counter = [0]

    def replace_block_latex(match: re.Match) -> str:
        key = f"LATEXPLACEHOLDER{counter[0]}END"
        counter[0] += 1
        latex_map[key] = (match.group(1), True)
        return key

    def replace_inline_latex(match: re.Match) -> str:
        key = f"LATEXPLACEHOLDER{counter[0]}END"
        counter[0] += 1
        latex_map[key] = (match.group(1), False)
        return key

    processed = re.sub(r"\$\$(.*?)\$\$", replace_block_latex, text, flags=re.DOTALL)
    processed = re.sub(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", replace_inline_latex, processed)

    html_output = _md(processed)

    for key, (latex_expr, is_block) in latex_map.items():
        try:
            mathml = latex2mathml.converter.convert(latex_expr)
            replacement = (
                f'<div class="math-block">{mathml}</div>'
                if is_block
                else f'<span class="math-inline">{mathml}</span>'
            )
        except Exception:
            replacement = (
                f'<div class="math-block math-error">$${latex_expr}$$</div>'
                if is_block
                else f'<span class="math-inline math-error">${latex_expr}$</span>'
            )
        html_output = html_output.replace(key, replacement)

    return html_output
