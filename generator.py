#!/usr/bin/env python3
"""
CheatSheet Generator - Standalone CLI Tool

Generate HTML cheatsheets from JSON configuration files.

Usage:
    python generator.py --title "My Cheatsheet" --config sections.json --output output.html
    python generator.py --config full_config.json --output output.html

JSON Configuration Format (sections.json):
{
    "title": "Cheatsheet Title",
    "sections": [
        {
            "title": "Section 1 Title",
            "lines": [
                {
                    "command": "df.{method:head}()",
                    "comment": "Shows first rows"
                }
            ]
        }
    ]
}

Syntax Highlighting in Commands:
    - {method:text} -> Red colored method names
    - {param:text}  -> Orange colored parameter names
    - {str:text}    -> Green colored strings
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime

# Color schemes for sections
SECTION_COLORS = [
    {
        'header_bg': 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
        'header_bg': 'linear-gradient(135deg, rgba(67, 233, 123, 0.15) 0%, rgba(56, 249, 215, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    },
    {
        'header_bg': 'linear-gradient(135deg, rgba(250, 112, 154, 0.15) 0%, rgba(254, 225, 64, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    },
    {
        'header_bg': 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
        'header_bg': 'linear-gradient(135deg, rgba(255, 154, 158, 0.15) 0%, rgba(250, 208, 196, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    },
    {
        'header_bg': 'linear-gradient(135deg, rgba(161, 196, 253, 0.15) 0%, rgba(194, 233, 251, 0.15) 100%)',
        'number_bg': 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'
    }
]


def strip_syntax_tags(command):
    """Remove syntax highlighting tags from a command, keeping only the visible text."""
    command = re.sub(r'\{method:([^}]+)\}', r'\1', command)
    command = re.sub(r'\{param:([^}]+)\}', r'\1', command)
    command = re.sub(r'\{str:([^}]+)\}', r'\1', command)
    return command


def format_text_with_lists(text):
    """Convert markdown-style lists to HTML lists."""
    lines = text.split('\n')
    result = []
    in_ul = False
    in_ol = False

    for line in lines:
        stripped = line.strip()

        if re.match(r'^[-*]\s+', stripped):
            content = re.sub(r'^[-*]\s+', '', stripped)
            if in_ol:
                result.append('</ol>')
                in_ol = False
            if not in_ul:
                result.append('<ul>')
                in_ul = True
            result.append(f'<li>{content}</li>')
        elif re.match(r'^\d+\.\s+', stripped):
            content = re.sub(r'^\d+\.\s+', '', stripped)
            if in_ul:
                result.append('</ul>')
                in_ul = False
            if not in_ol:
                result.append('<ol>')
                in_ol = True
            result.append(f'<li>{content}</li>')
        else:
            if in_ul:
                result.append('</ul>')
                in_ul = False
            if in_ol:
                result.append('</ol>')
                in_ol = False
            if stripped:
                result.append(stripped)

    if in_ul:
        result.append('</ul>')
    if in_ol:
        result.append('</ol>')

    return '\n'.join(result)


def apply_syntax_highlighting(command):
    """Apply syntax highlighting to a command string.

    Patterns:
    - {method:text} -> <span class="method">text</span>
    - {param:text} -> <span class="parameter">text</span>
    - {str:text} -> <span class="string">text</span>
    - # comment -> <span class="inline-comment"># comment</span>
    """
    command = re.sub(r'\{method:([^}]+)\}', r'<span class="method">\1</span>', command)
    command = re.sub(r'\{param:([^}]+)\}', r'<span class="parameter">\1</span>', command)
    command = re.sub(r'\{str:([^}]+)\}', r'<span class="string">\1</span>', command)
    # Highlight inline comments (# ...) in green
    command = re.sub(r'(^|\s)(#.*)$', r'\1<span class="inline-comment">\2</span>', command)
    return command


def get_image_html(image_data, css_class, alt_text="Image"):
    """Generate HTML for an image with optional percentage width.

    Supports both string format (old) and object format (new with widthPercent).
    """
    if isinstance(image_data, str):
        src = image_data
        width_percent = None
    else:
        src = image_data.get('src', '')
        width_percent = image_data.get('widthPercent')

    style_attr = f' style="width: {width_percent}%"' if width_percent else ''

    return f'<img src="{src}" class="{css_class} zoomable" alt="{alt_text}" onclick="openImageLightbox(this)"{style_attr}>'


def generate_html(title, sections):
    """Generate standalone HTML from cheatsheet data."""

    # Generate index if any section has a description
    index_html = ''
    has_descriptions = any(s.get('description') for s in sections)
    if has_descriptions:
        index_items = ''
        for i, section in enumerate(sections):
            section_num = i + 1
            section_title = section.get('title', f'Section {section_num}')
            description = section.get('description', '')
            desc_html = f' - <span class="index-description">{description}</span>' if description else ''
            index_items += f'''
                <li><a href="#section-{section_num}" onclick="expandSection({section_num}); return false;">{section_num}. {section_title}</a>{desc_html}</li>'''

        index_html = f'''
        <div class="index-section">
            <div class="index-header" onclick="toggleIndex(this)">
                <h2>Index</h2>
                <div class="toggle-icon">▼</div>
            </div>
            <ul class="index-list">{index_items}
            </ul>
        </div>'''

    sections_html = ''
    for i, section in enumerate(sections):
        section_num = i + 1

        # Generate section images HTML if present (support both old 'image' and new 'images')
        section_image_html = ''
        images = section.get('images', [])
        if not images and section.get('image'):
            images = [section['image']]
        if images:
            images_html = ''.join([get_image_html(img, 'section-image', 'Section image') for img in images])
            section_image_html = f'''
                <div class="section-image-container">
                    {images_html}
                </div>'''

        # Generate code lines HTML
        code_lines_html = ''
        for line in section.get('lines', []):
            line_type = line.get('type', 'code')
            command = line.get('command', '')
            comment = line.get('comment', '')

            if line_type == 'text':
                text_content = line.get('text', command or comment)
                text_content = format_text_with_lists(text_content)
                code_lines_html += f'''
                <div class="text-line">{text_content}</div>'''
            else:
                highlighted_command = apply_syntax_highlighting(command)
                import html
                clean_command = strip_syntax_tags(command)
                encoded_command = html.escape(clean_command, quote=True)
                code_lines_html += f'''
                <div class="code-line">
                    <span class="code-command">{highlighted_command}</span>
                    <span class="code-comment">{comment}</span>
                    <button class="copy-line-btn" data-code="{encoded_command}" onclick="copyLine(this)" title="Copy code">📋</button>
                </div>'''

        # Generate subsections HTML with grid container
        subsections_html = ''
        subsections_list = section.get('subsections', [])
        if subsections_list:
            subsections_html = '\n                <div class="subsections-grid">'
        for j, subsection in enumerate(subsections_list):
            subsection_num = f"{section_num}.{j + 1}"

            # Subsection images (support both old 'image' and new 'images')
            sub_image_html = ''
            sub_images = subsection.get('images', [])
            if not sub_images and subsection.get('image'):
                sub_images = [subsection['image']]
            if sub_images:
                sub_images_html = ''.join([get_image_html(img, 'subsection-image', 'Subsection image') for img in sub_images])
                sub_image_html = f'''
                    <div class="subsection-image-container">
                        {sub_images_html}
                    </div>'''

            # Subsection code lines
            sub_code_lines_html = ''
            for line in subsection.get('lines', []):
                line_type = line.get('type', 'code')
                command = line.get('command', '')
                comment = line.get('comment', '')

                if line_type == 'text':
                    text_content = line.get('text', command or comment)
                    text_content = format_text_with_lists(text_content)
                    sub_code_lines_html += f'''
                    <div class="text-line">{text_content}</div>'''
                else:
                    highlighted_command = apply_syntax_highlighting(command)
                    import html
                    clean_command = strip_syntax_tags(command)
                    encoded_command = html.escape(clean_command, quote=True)
                    sub_code_lines_html += f'''
                    <div class="code-line">
                        <span class="code-command">{highlighted_command}</span>
                        <span class="code-comment">{comment}</span>
                        <button class="copy-line-btn" data-code="{encoded_command}" onclick="copyLine(this)" title="Copy code">📋</button>
                    </div>'''

            subsections_html += f'''
                    <div class="subsection" id="subsection-{subsection_num.replace('.', '-')}">
                        <div class="subsection-header" onclick="toggleSubsection(this)">
                            <div class="subsection-header-left">
                                <div class="subsection-number">{subsection_num}</div>
                                <div class="subsection-title">{subsection.get('title', '')}</div>
                            </div>
                            <div class="toggle-icon">▼</div>
                        </div>
                        <div class="subsection-content">{sub_image_html}{sub_code_lines_html}
                        </div>
                    </div>'''

        # Close the subsections grid container
        if subsections_list:
            subsections_html += '\n                </div>'

        sections_html += f'''
        <div class="section section-{section_num}" id="section-{section_num}" data-section="{section_num}">
            <div class="section-header" onclick="toggleSection(this)">
                <div class="section-header-left">
                    <div class="section-number">{section_num}</div>
                    <div class="section-title">{section.get('title', '')}</div>
                </div>
                <div class="toggle-icon">▼</div>
            </div>
            <div class="section-content">{section_image_html}{code_lines_html}{subsections_html}
            </div>
        </div>'''

    # Generate dynamic CSS for section colors
    section_styles = ''
    for i in range(len(sections)):
        color_idx = i % len(SECTION_COLORS)
        section_num = i + 1
        colors = SECTION_COLORS[color_idx]
        section_styles += f'''
        .section-{section_num} .section-header {{
            background: {colors['header_bg']};
        }}
        .section-{section_num} .section-number {{
            background: {colors['number_bg']};
        }}'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            padding: 15px;
            min-height: 100vh;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
        }}

        .header {{
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 20px 30px;
            text-align: center;
        }}

        .header h1 {{
            font-size: 1.8rem;
            font-weight: 700;
            letter-spacing: 1px;
        }}

        .controls {{
            display: flex;
            justify-content: center;
            gap: 10px;
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }}

        .controls button {{
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s ease;
        }}

        .btn-expand {{
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: white;
        }}

        .btn-collapse {{
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: white;
        }}

        .controls button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}

        .section {{
            padding: 0;
            border-bottom: 1px solid #e0e0e0;
        }}

        .section:last-child {{
            border-bottom: none;
        }}

        .section-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 20px;
            border-radius: 0;
            cursor: pointer;
            transition: all 0.3s ease;
            user-select: none;
        }}

        .section-header:hover {{
            opacity: 0.9;
        }}

        .section-header-left {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .section-header-right {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .copy-btn {{
            background: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 5px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s ease;
        }}

        .copy-btn:hover {{
            background: rgba(255, 255, 255, 0.95);
            transform: scale(1.05);
        }}

        .copy-btn.copied {{
            background: #27ae60;
            color: white;
        }}

        .toggle-icon {{
            font-size: 1.2rem;
            transition: transform 0.3s ease;
            color: #2c3e50;
        }}

        .section-number {{
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            font-weight: bold;
            color: white;
            flex-shrink: 0;
        }}

        .section-title {{
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
        }}

        .section-content {{
            padding: 0 20px 15px 20px;
        }}

        .section.collapsed .toggle-icon {{
            transform: rotate(-90deg);
        .code-line {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 14px;
            font-family: 'Courier New', monospace;
            font-size: 0.92rem;
            margin: 3px 0;
            border-radius: 5px;
            transition: background-color 0.2s ease;
        }}

        .code-line:nth-child(odd) {{
            background-color: #f8f9fa;
        }}

        .code-line:nth-child(even) {{
            background-color: #ffffff;
        }}

        .code-line:hover {{
            background-color: #e9ecef;
        }}

        .copy-line-btn {{
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 0.8rem;
            padding: 2px 6px;
            opacity: 0;
            transition: all 0.2s ease;
            border-radius: 4px;
            flex-shrink: 0;
        }}

        .code-line:hover .copy-line-btn {{
            opacity: 0.6;
        }}

        .copy-line-btn:hover {{
            opacity: 1 !important;
            background: rgba(0,0,0,0.1);
        }}

        .copy-line-btn.copied {{
            opacity: 1 !important;
            color: #27ae60;
        }}

        .code-command {{
            color: #2c3e50;
            font-weight: 500;
        }}

        .method {{
            color: #e74c3c;
        }}

        .parameter {{
            color: #f39c12;
        }}

        .string {{
            color: #27ae60;
        }}

        .inline-comment {{
            color: #27ae60;
            font-style: italic;
        }}

        .code-comment {{
            color: #6c757d;
            font-style: italic;
            padding-left: 15px;
            font-size: 0.88rem;
        }}

        .code-comment::before {{
            content: "# ";
        }}

        /* Text Line Styles */
        .text-line {{
            padding: 10px 14px;
            font-size: 0.95rem;
            margin: 5px 0;
            border-radius: 5px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
            border-left: 3px solid #667eea;
            line-height: 1.6;
            color: #2c3e50;
        }}

        .text-line:hover {{
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }}

        /* List styles in text lines */
        .text-line ul, .text-line ol {{
            margin: 8px 0 8px 20px;
            padding: 0;
        }}

        .text-line li {{
            margin: 4px 0;
            line-height: 1.5;
        }}

        .text-line ul {{
            list-style-type: disc;
        }}

        .text-line ol {{
            list-style-type: decimal;
        }}

        /* Zoomable images */
        .zoomable {{
            cursor: zoom-in;
            transition: transform 0.2s ease;
        }}

        .zoomable:hover {{
            transform: scale(1.02);
        }}

        /* Image Lightbox */
        .image-lightbox {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            justify-content: center;
            align-items: center;
            cursor: zoom-out;
        }}

        .image-lightbox.active {{
            display: flex;
        }}

        .lightbox-image {{
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
        }}

        .lightbox-close {{
            position: absolute;
            top: 20px;
            right: 30px;
            font-size: 2rem;
            color: white;
            cursor: pointer;
            background: none;
            border: none;
            opacity: 0.8;
            transition: opacity 0.2s;
        }}

        .lightbox-close:hover {{
            opacity: 1;
        }}

        /* Index Styles */
        .index-section {{
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }}

        .index-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            cursor: pointer;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }}

        .index-header h2 {{
            font-size: 1.1rem;
            color: #2c3e50;
            margin: 0;
        }}

        .index-header:hover {{
            opacity: 0.9;
        }}

        .index-list {{
            list-style: none;
            padding: 15px 20px;
            margin: 0;
            max-height: 50vh;
            overflow-y: auto;
            overflow-x: hidden;
        }}

        .index-section.collapsed .index-list {{
            display: none;
        }}

        .index-section.collapsed .toggle-icon {{
            transform: rotate(-90deg);
        }}

        .index-list li {{
            padding: 8px 0;
            border-bottom: 1px dashed #e0e0e0;
        }}

        .index-list li:last-child {{
            border-bottom: none;
        }}

        .index-list a {{
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }}

        .index-list a:hover {{
            text-decoration: underline;
        }}

        .index-description {{
            color: #6c757d;
            font-size: 0.9rem;
        }}

        /* Section Image Styles */
        .section-image-container,
        .subsection-image-container {{
            margin-bottom: 15px;
            text-align: center;
        }}

        .section-image,
        .subsection-image {{
            max-width: 100%;
            max-height: 400px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }}

        /* Subsections Grid Container - Left to Right Flow */
        .subsections-grid {{
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 15px 0;
            align-items: stretch;
        }}

        /* Subsection Styles - Adapt to content */
        .subsection {{
            flex: 0 1 auto;
            min-width: 200px;
            max-width: 100%;
            margin: 0;
            border: 1px solid #e0e0e0;
            border-left: 4px solid #667eea;
            background: #fafbfc;
            border-radius: 8px;
        }}

        /* Allow subsection to grow with image */
        .subsection-image-container {{
            display: flex;
            justify-content: center;
        }}

        .subsection-image {{
            max-width: 100%;
            height: auto;
        }}

        .subsection-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 15px;
            cursor: pointer;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
            border-radius: 8px 8px 0 0;
        }}

        .subsection-header:hover {{
            opacity: 0.9;
        }}

        .subsection-header-left {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}

        .subsection-number {{
            width: 36px;
            height: 24px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: bold;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            flex-shrink: 0;
        }}

        .subsection-title {{
            font-size: 0.95rem;
            font-weight: 600;
            color: #2c3e50;
        }}

        .subsection-content {{
            padding: 10px 15px;
        }}

        .subsection.collapsed .toggle-icon {{
            transform: rotate(-90deg);
        }}

        .subsection.collapsed .subsection-content {{
            display: none;
        }}

        .subsection .code-line {{
            font-size: 0.9rem;
        }}

        .subsection .code-comment {{
            font-size: 0.85rem;
        }}

        /* Print Button */
        .btn-print {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}

        /* Print Styles - Compact Version */
        @media print {{
            @page {{
                margin: 0.3cm;
                size: A4;
            }}

            body {{
                background: white !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-size: 9pt !important;
            }}

            .container {{
                box-shadow: none !important;
                max-width: 100% !important;
                border-radius: 0 !important;
            }}

            .header {{
                background: #4a5568 !important;
                padding: 6px 10px !important;
            }}

            .header h1 {{
                font-size: 1.1rem !important;
            }}

            .controls, .toggle-icon, .copy-btn, .copy-line-btn, .section-header-right {{
                display: none !important;
            }}

            /* Force ALL content visible when printing - ignore collapsed state */
            .section-content,
            .section.collapsed .section-content {{
                display: block !important;
                max-height: none !important;
                overflow: visible !important;
                padding: 3px 8px !important;
            }}

            .subsection-content,
            .subsection.collapsed .subsection-content {{
                display: block !important;
                max-height: none !important;
                overflow: visible !important;
                padding: 2px 4px !important;
            }}

            .index-list,
            .index-section.collapsed .index-list {{
                display: block !important;
                max-height: none !important;
                overflow: visible !important;
                padding: 3px 8px !important;
                columns: 2 !important;
                column-gap: 15px !important;
            }}

            .section {{
                margin-bottom: 2px !important;
                border-bottom: none !important;
            }}

            .section-header {{
                padding: 4px 8px !important;
                cursor: default !important;
            }}

            /* Soft pastel colors for sections */
            .section-1 .section-header {{ background: #e8eaf6 !important; }}
            .section-2 .section-header {{ background: #fce4ec !important; }}
            .section-3 .section-header {{ background: #e8f5e9 !important; }}
            .section-4 .section-header {{ background: #fff3e0 !important; }}
            .section-5 .section-header {{ background: #e3f2fd !important; }}
            .section-6 .section-header {{ background: #f3e5f5 !important; }}
            .section-7 .section-header {{ background: #e0f2f1 !important; }}
            .section-8 .section-header {{ background: #fbe9e7 !important; }}

            .section-1 .section-number {{ background: #5c6bc0 !important; }}
            .section-2 .section-number {{ background: #ec407a !important; }}
            .section-3 .section-number {{ background: #66bb6a !important; }}
            .section-4 .section-number {{ background: #ffa726 !important; }}
            .section-5 .section-number {{ background: #42a5f5 !important; }}
            .section-6 .section-number {{ background: #ab47bc !important; }}
            .section-7 .section-number {{ background: #26a69a !important; }}
            .section-8 .section-number {{ background: #ef5350 !important; }}

            .section-number {{
                width: 18px !important;
                height: 18px !important;
                font-size: 0.65rem !important;
            }}

            .section-title {{
                font-size: 0.8rem !important;
            }}

            /* Allow sections to break across pages, but keep subsections intact */
            .section {{
                break-inside: auto !important;
                page-break-inside: auto !important;
            }}

            .section-content {{
                break-inside: auto !important;
                page-break-inside: auto !important;
            }}

            /* CSS Grid layout - 2 columns, fills space naturally */
            .subsections-grid {{
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 4px !important;
                break-inside: auto !important;
                page-break-inside: auto !important;
            }}

            /* Subsection styling */
            .subsection {{
                display: block !important;
                width: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                font-size: 0.6rem !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                border-left-width: 2px !important;
            }}

            .subsection * {{
                font-size: 0.6rem !important;
            }}

            /* Force expand all collapsed subsections */
            .subsection.collapsed {{
                display: block !important;
            }}

            .subsection-content,
            .subsection.collapsed .subsection-content {{
                display: block !important;
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
                padding: 2px 4px !important;
            }}

            .subsection-header {{
                padding: 2px 5px !important;
                background: transparent !important;
            }}

            .subsection-number {{
                font-size: 0.5rem !important;
                padding: 1px 3px !important;
            }}

            .subsection-title {{
                font-size: 0.65rem !important;
            }}

            /* Soft pastel colors for subsections */
            .section-1 .subsection {{ background: #ede7f6 !important; border-left-color: #7e57c2 !important; }}
            .section-2 .subsection {{ background: #fce4ec !important; border-left-color: #f06292 !important; }}
            .section-3 .subsection {{ background: #e8f5e9 !important; border-left-color: #81c784 !important; }}
            .section-4 .subsection {{ background: #fff8e1 !important; border-left-color: #ffb74d !important; }}
            .section-5 .subsection {{ background: #e1f5fe !important; border-left-color: #4fc3f7 !important; }}
            .section-6 .subsection {{ background: #f3e5f5 !important; border-left-color: #ba68c8 !important; }}
            .section-7 .subsection {{ background: #e0f2f1 !important; border-left-color: #4db6ac !important; }}
            .section-8 .subsection {{ background: #ffebee !important; border-left-color: #e57373 !important; }}

            .code-line {{
                padding: 0px 4px !important;
                font-size: 0.6rem !important;
                margin: 0 !important;
                border-radius: 1px !important;
            }}

            .code-line:nth-child(odd) {{
                background-color: rgba(0, 0, 0, 0.06) !important;
            }}

            .code-line:nth-child(even) {{
                background-color: rgba(255, 255, 255, 0.4) !important;
            }}

            .text-line {{
                padding: 1px 4px !important;
                font-size: 0.6rem !important;
                margin: 0 !important;
                background: rgba(255,255,255,0.6) !important;
                border-left-width: 2px !important;
            }}

            .code-comment {{
                font-size: 0.55rem !important;
                padding-left: 6px !important;
            }}

            .method {{ color: #1565c0 !important; font-weight: 600 !important; }}
            .parameter {{ color: #e65100 !important; }}
            .string {{ color: #2e7d32 !important; }}
            .inline-comment {{ color: #2e7d32 !important; }}

            .index-section {{
                background: #e3f2fd !important;
                margin-bottom: 1px !important;
            }}

            .index-header {{
                background: #bbdefb !important;
                padding: 3px 6px !important;
            }}

            .index-title {{
                font-size: 0.8rem !important;
            }}

            .index-list li {{
                padding: 1px 0 !important;
                font-size: 0.7rem !important;
                break-inside: avoid !important;
            }}

            .index-list a {{
                color: #333 !important;
            }}

            .section-image-container,
            .subsection-image-container {{
                margin: 2px 0 !important;
            }}

            .section-image,
            .subsection-image {{
                max-height: 80px !important;
                max-width: 40% !important;
            }}
        }}

        {section_styles}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
        </div>

        <div class="controls">
            <button class="btn-expand" onclick="expandAll()">Expand All</button>
            <button class="btn-collapse" onclick="collapseAll()">Collapse All</button>
            <button class="btn-print" onclick="printCheatsheet()">Print / PDF</button>
        </div>
{index_html}{sections_html}
    </div>

    <!-- Image Lightbox -->
    <div class="image-lightbox" id="imageLightbox" onclick="closeLightbox()">
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
        <img class="lightbox-image" id="lightboxImage" src="" alt="Zoomed image" onclick="event.stopPropagation()">
    </div>

    <script>
        function toggleSection(header) {{
            const section = header.parentElement;
            section.classList.toggle('collapsed');
        }}

        function toggleSubsection(header) {{
            const subsection = header.parentElement;
            subsection.classList.toggle('collapsed');
        }}

        function toggleIndex(header) {{
            const indexSection = header.parentElement;
            indexSection.classList.toggle('collapsed');
        }}

        function expandAll() {{
            document.querySelectorAll('.section').forEach(section => {{
                section.classList.remove('collapsed');
            }});
            // Keep subsections collapsed - only expand sections
            const indexSection = document.querySelector('.index-section');
            if (indexSection) indexSection.classList.remove('collapsed');
        }}

        function expandAllWithSubsections() {{
            document.querySelectorAll('.section').forEach(section => {{
                section.classList.remove('collapsed');
            }});
            document.querySelectorAll('.subsection').forEach(subsection => {{
                subsection.classList.remove('collapsed');
            }});
            const indexSection = document.querySelector('.index-section');
            if (indexSection) indexSection.classList.remove('collapsed');
        }}

        function collapseAll() {{
            document.querySelectorAll('.section').forEach(section => {{
                section.classList.add('collapsed');
            }});
            document.querySelectorAll('.subsection').forEach(subsection => {{
                subsection.classList.add('collapsed');
            }});
            const indexSection = document.querySelector('.index-section');
            if (indexSection) indexSection.classList.add('collapsed');
        }}

        function printCheatsheet() {{
            // Force ALL content to be visible with inline styles
            document.querySelectorAll('.section-content, .subsection-content, .index-list').forEach(el => {{
                el.style.display = 'block';
            }});

            // Wait for DOM to update, then print
            setTimeout(function() {{
                window.print();

                // Remove inline styles after print
                setTimeout(function() {{
                    document.querySelectorAll('.section-content, .subsection-content, .index-list').forEach(el => {{
                        el.style.display = '';
                    }});
                }}, 500);
            }}, 100);
        }}

        function expandSection(sectionNum) {{
            // Collapse all sections first
            document.querySelectorAll('.section').forEach(section => {{
                section.classList.add('collapsed');
            }});
            // Expand only the selected section
            const target = document.getElementById('section-' + sectionNum);
            if (target) {{
                target.classList.remove('collapsed');
                target.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
            }}
        }}

        function copyLine(button) {{
            // Get code from data attribute
            const code = button.getAttribute('data-code');
            // Decode HTML entities
            const txt = document.createElement('textarea');
            txt.innerHTML = code;
            const decodedCode = txt.value;

            navigator.clipboard.writeText(decodedCode).then(() => {{
                button.classList.add('copied');
                button.textContent = '✓';
                setTimeout(() => {{
                    button.classList.remove('copied');
                    button.textContent = '📋';
                }}, 1000);
            }}).catch(err => {{
                console.error('Failed to copy:', err);
            }});
        }}

        // Image zoom/lightbox functionality
        function openImageLightbox(img) {{
            const lightbox = document.getElementById('imageLightbox');
            const lightboxImg = document.getElementById('lightboxImage');
            lightboxImg.src = img.src;
            lightbox.classList.add('active');
        }}

        function closeLightbox() {{
            document.getElementById('imageLightbox').classList.remove('active');
        }}

        // Close lightbox on escape key
        document.addEventListener('keydown', function(e) {{
            if (e.key === 'Escape') {{
                closeLightbox();
            }}
        }});

        // Keyboard shortcuts: Ctrl+E expand, Ctrl+Q collapse
        document.addEventListener('keydown', function(e) {{
            if (e.ctrlKey && e.key === 'e') {{
                e.preventDefault();
                expandAll();
            }}
            if (e.ctrlKey && e.key === 'q') {{
                e.preventDefault();
                collapseAll();
            }}
        }});

        // Initialize: collapse all sections, keep index expanded
        document.addEventListener('DOMContentLoaded', function() {{
            // Collapse all sections
            document.querySelectorAll('.section').forEach(section => {{
                section.classList.add('collapsed');
            }});
            // Collapse all subsections
            document.querySelectorAll('.subsection').forEach(subsection => {{
                subsection.classList.add('collapsed');
            }});
            // Keep index expanded (do not add collapsed class)
            // Index is expanded by default since we don't add 'collapsed' class
        }});
    </script>
</body>
</html>'''

    return html


def load_config(config_path):
    """Load configuration from JSON file."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_html(html_content, output_path):
    """Save HTML content to file."""
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def main():
    parser = argparse.ArgumentParser(
        description='Generate HTML cheatsheets from JSON configuration.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python generator.py --config config.json --output cheatsheet.html
  python generator.py --title "Python Basics" --config sections.json -o python_basics.html

JSON Format:
  {
    "title": "My Cheatsheet",
    "sections": [
      {
        "title": "Section 1",
        "lines": [
          {"command": "code here", "comment": "description"}
        ]
      }
    ]
  }

Syntax Highlighting:
  Use {method:text}, {param:text}, {str:text} in commands for colored output.
        '''
    )

    parser.add_argument(
        '--config', '-c',
        required=True,
        help='Path to JSON configuration file'
    )

    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output HTML file path'
    )

    parser.add_argument(
        '--title', '-t',
        help='Cheatsheet title (overrides config file)'
    )

    parser.add_argument(
        '--auto-save', '-a',
        action='store_true',
        help='Auto-save to cheatsheets/ folder'
    )

    args = parser.parse_args()

    # Load configuration
    try:
        config = load_config(args.config)
    except FileNotFoundError:
        print(f"Error: Configuration file not found: {args.config}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in configuration file: {e}")
        sys.exit(1)

    # Get title and sections
    title = args.title or config.get('title', 'Cheatsheet')
    sections = config.get('sections', [])

    if not sections:
        print("Error: No sections found in configuration")
        sys.exit(1)

    # Generate HTML
    html_content = generate_html(title, sections)

    # Save output
    try:
        save_html(html_content, args.output)
        print(f"Cheatsheet generated: {args.output}")

        # Auto-save to cheatsheets folder
        if args.auto_save:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            cheatsheets_dir = os.path.join(script_dir, 'cheatsheets')
            os.makedirs(cheatsheets_dir, exist_ok=True)

            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            auto_path = os.path.join(cheatsheets_dir, f"{safe_title}.html")
            save_html(html_content, auto_path)
            print(f"Also saved to: {auto_path}")

    except IOError as e:
        print(f"Error saving file: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
