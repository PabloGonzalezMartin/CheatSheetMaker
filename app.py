"""
CheatSheet Maker - Flask Application
A web application for creating and managing HTML cheatsheets.
"""

import os
import re
import hashlib
import base64
import html as html_module
from io import BytesIO
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, Response
from flask_login import LoginManager, login_required, current_user
from flask_migrate import Migrate
from werkzeug.utils import secure_filename
from models import db, User, Cheatsheet, Group, Image
from auth import auth
from config import DevelopmentConfig, ProductionConfig

# Allowed image extensions
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}


def create_app(config_class=None):
    app = Flask(__name__)

    if config_class is None:
        config_class = ProductionConfig if os.environ.get('FLASK_ENV') == 'production' else DevelopmentConfig
    app.config.from_object(config_class)

    db.init_app(app)
    Migrate(app, db)

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Authentication required'}), 401
        return redirect(url_for('auth.login', next=request.url))

    app.register_blueprint(auth)

    # Register routes
    register_routes(app)

    return app


def generate_cheatsheet_id(title, user_id=None):
    """Generate a filename-safe ID from title with a short hash."""
    clean_title = re.sub(r'[^a-zA-Z0-9\s_-]', '', title.lower())
    clean_title = re.sub(r'\s+', '_', clean_title.strip())
    clean_title = clean_title[:30]

    hash_input = f"{user_id}:{title}" if user_id else title
    hash_str = hashlib.md5(hash_input.encode()).hexdigest()[:6]

    return f"{clean_title}_{hash_str}" if clean_title else hash_str


def allowed_image_file(filename):
    """Check if the file has an allowed image extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def generate_image_filename(original_filename):
    """Generate a unique filename for an uploaded image."""
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    random_hash = hashlib.md5(os.urandom(16)).hexdigest()[:6]
    return f"img_{timestamp}_{random_hash}.{ext}"


# Color schemes for sections (cycles through these)
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


def convert_url_to_base64(url_path):
    """Convert a local image URL to base64 data URI by reading from the database."""
    if not url_path or not url_path.startswith('/images/'):
        return url_path

    parts = url_path.strip('/').split('/')
    if len(parts) < 3:
        return url_path

    cheatsheet_id = parts[1]
    filename = parts[2]

    image = Image.query.filter_by(cheatsheet_id=cheatsheet_id, filename=filename).first()
    if not image:
        return url_path

    try:
        base64_data = base64.b64encode(image.data).decode('utf-8')
        return f"data:{image.content_type};base64,{base64_data}"
    except Exception:
        return url_path


def get_image_html(image_data, css_class, alt_text="Image"):
    """Generate HTML for an image with optional percentage width."""
    if isinstance(image_data, str):
        src = image_data
        width_percent = None
    else:
        src = image_data.get('src', '')
        width_percent = image_data.get('widthPercent')

    if src.startswith('/images/'):
        src = convert_url_to_base64(src)

    style_attr = f' style="width: {width_percent}%"' if width_percent else ''

    return f'<img src="{src}" class="{css_class} zoomable" alt="{alt_text}" onclick="openImageLightbox(this)"{style_attr}>'


def strip_syntax_tags(command):
    """Remove syntax highlighting tags from a command, keeping only the visible text.

    Converts {method:text} -> text, {param:text} -> text, {str:text} -> text
    """
    command = re.sub(r'\{method:([^}]+)\}', r'\1', command)
    command = re.sub(r'\{param:([^}]+)\}', r'\1', command)
    command = re.sub(r'\{str:([^}]+)\}', r'\1', command)
    return command


def format_text_with_lists(text):
    """Convert markdown-style lists to HTML lists.

    Supports:
    - Unordered lists: lines starting with - or *
    - Ordered lists: lines starting with 1. 2. etc.
    """
    lines = text.split('\n')
    result = []
    in_ul = False
    in_ol = False

    for line in lines:
        stripped = line.strip()

        # Check for unordered list item (- or *)
        if re.match(r'^[-*]\s+', stripped):
            content = re.sub(r'^[-*]\s+', '', stripped)
            if in_ol:
                result.append('</ol>')
                in_ol = False
            if not in_ul:
                result.append('<ul>')
                in_ul = True
            result.append(f'<li>{content}</li>')
        # Check for ordered list item (1. 2. etc.)
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
            # Close any open lists
            if in_ul:
                result.append('</ul>')
                in_ul = False
            if in_ol:
                result.append('</ol>')
                in_ol = False
            if stripped:
                result.append(stripped)

    # Close any remaining open lists
    if in_ul:
        result.append('</ul>')
    if in_ol:
        result.append('</ol>')

    return '\n'.join(result)


def apply_syntax_highlighting(command):
    """Apply syntax highlighting to a command string."""
    command = re.sub(r'\{method:([^}]+)\}', r'<span class="method">\1</span>', command)
    command = re.sub(r'\{param:([^}]+)\}', r'<span class="parameter">\1</span>', command)
    command = re.sub(r'\{str:([^}]+)\}', r'<span class="string">\1</span>', command)
    command = re.sub(r'(^|\s)(#.*)$', r'\1<span class="inline-comment">\2</span>', command)
    return command


def generate_html(data):
    """Generate standalone HTML from cheatsheet data."""
    title = data.get('title', 'Cheatsheet')
    sections = data.get('sections', [])

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
                <li><a href="#section-{section_num}" onclick="expandSection({section_num}); return false;">{section_title}</a>{desc_html}</li>'''

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
        color_idx = i % len(SECTION_COLORS)
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
                # Text-only line with list support
                text_content = line.get('text', command or comment)
                text_content = format_text_with_lists(text_content)
                code_lines_html += f'''
                <div class="text-line">{text_content}</div>'''
            else:
                # Code line with syntax highlighting and copy button
                highlighted_command = apply_syntax_highlighting(command)
                # Create clean command for copying (remove syntax tags)
                clean_command = strip_syntax_tags(command)
                # Encode for safe data attribute storage
                encoded_command = html_module.escape(clean_command, quote=True)
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
                    clean_command = strip_syntax_tags(command)
                    encoded_command = html_module.escape(clean_command, quote=True)
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

        # Close the subsections grid container and add toggle buttons
        if subsections_list:
            subsections_html += '\n                </div>'
            # Add minimalist subsection toggle buttons before the grid
            subsections_toggle_html = f'''
                <div class="subsections-controls">
                    <button class="subsections-toggle-btn" onclick="expandAllSubsections({section_num})" title="Expand all subsections">+</button>
                    <button class="subsections-toggle-btn" onclick="collapseAllSubsections({section_num})" title="Collapse all subsections">−</button>
                </div>'''
            subsections_html = subsections_toggle_html + subsections_html

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
        }}

        .section.collapsed .section-content {{
            display: none;
        }}

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

        /* Section Image Styles - Stack vertically */
        .section-image-container,
        .subsection-image-container {{
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }}

        .section-image,
        .subsection-image {{
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            object-fit: contain;
        }}

        /* Subsection toggle controls */
        .subsections-controls {{
            display: flex;
            justify-content: flex-start;
            gap: 4px;
            margin-bottom: 8px;
        }}

        .subsections-toggle-btn {{
            width: 24px;
            height: 24px;
            border: 1px solid #f5c6a0;
            border-radius: 4px;
            background: #fff5eb;
            color: #d97706;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            line-height: 1;
        }}

        .subsections-toggle-btn:hover {{
            background: #fed7aa;
            border-color: #fb923c;
            color: #c2410c;
        }}

        .subsections-toggle-btn:active {{
            transform: scale(0.95);
        }}

        .subsections-grid {{
            column-count: 3;           /* 3 columnas */
            column-gap: 15px;          /* Espacio entre columnas */
            margin: 15px 0;
        }}

        .subsection {{
            break-inside: avoid;       /* No dividir entre columnas */
            display: inline-block;     /* Importante para column-count */
            width: 100%;               /* Ocupa ancho completo de la columna */
            margin-bottom: 15px;       /* Espacio vertical entre elementos */
            border: 1px solid #e0e0e0;
            border-left: 4px solid #667eea;
            background: #fafbfc;
            border-radius: 8px;
            overflow: hidden;
            page-break-inside: avoid;  /* Para compatibilidad */
        }}

        /* Subsection images constrained to container */
        .subsection .subsection-image-container {{
            width: 100%;
            padding: 0 10px;
            box-sizing: border-box;
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

        /* Footer */
        .cheatsheet-footer {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 12px 20px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
            font-size: 0.85rem;
            color: #6c757d;
        }}

        .cheatsheet-footer a {{
            display: flex;
            align-items: center;
            gap: 5px;
            color: #0077b5;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }}

        .cheatsheet-footer a:hover {{
            color: #005582;
            text-decoration: underline;
        }}

        .linkedin-icon {{
            width: 16px;
            height: 16px;
            color: #0077b5;
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

            .controls, .toggle-icon, .copy-btn, .copy-line-btn, .section-header-right, .subsections-controls {{
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
                column-count: 2 !important;
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
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                gap: 4px !important;
            }}

            .section-image,
            .subsection-image {{
                max-height: 120px !important;
                height: auto !important;
                object-fit: contain !important;
                border-radius: 4px !important;
                box-shadow: none !important;
            }}

            /* Footer for print - appears on every page */
            .cheatsheet-footer {{
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 1px 10px !important;
                background: white !important;
                border-top: 1px solid #ccc !important;
                font-size: 0.6rem !important;
                text-align: center;
            }}

            .cheatsheet-footer a {{
                color: #0077b5 !important;
            }}

            .linkedin-icon {{
                width: 10px !important;
                height: 10px !important;
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

        <!-- Footer -->
        <div class="cheatsheet-footer">
            <span>Created by</span>
            <a href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" target="_blank" rel="noopener">
                <svg class="linkedin-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Pablo González Martín
            </a>
        </div>
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

        function expandAllSubsections(sectionNum) {{
            const section = document.getElementById('section-' + sectionNum);
            if (section) {{
                section.querySelectorAll('.subsection').forEach(sub => {{
                    sub.classList.remove('collapsed');
                }});
            }}
        }}

        function collapseAllSubsections(sectionNum) {{
            const section = document.getElementById('section-' + sectionNum);
            if (section) {{
                section.querySelectorAll('.subsection').forEach(sub => {{
                    sub.classList.add('collapsed');
                }});
            }}
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

        // Keyboard shortcuts
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


def register_routes(app):
    """Register all application routes."""

    # ─── Page Routes ──────────────────────────────────────────────

    @app.route('/')
    @login_required
    def index():
        """Serve the main editor page."""
        cheatsheets = Cheatsheet.query.filter_by(user_id=current_user.id)\
            .order_by(Cheatsheet.updated_at.desc()).all()
        cs_list = [{
            'id': c.id,
            'title': c.title,
            'group': c.group_id or '',
            'created_at': c.created_at.isoformat() if c.created_at else '',
            'updated_at': c.updated_at.isoformat() if c.updated_at else ''
        } for c in cheatsheets]

        groups = Group.query.filter_by(user_id=current_user.id).all()
        groups_list = [{'id': g.id, 'name': g.name, 'color': g.color} for g in groups]

        return render_template('index.html', cheatsheets=cs_list, groups=groups_list)

    @app.route('/edit/<cheatsheet_id>')
    @login_required
    def edit_cheatsheet(cheatsheet_id):
        """Edit an existing cheatsheet."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if cs:
            cheatsheets = Cheatsheet.query.filter_by(user_id=current_user.id)\
                .order_by(Cheatsheet.updated_at.desc()).all()
            cs_list = [{
                'id': c.id, 'title': c.title, 'group': c.group_id or '',
                'created_at': c.created_at.isoformat() if c.created_at else '',
                'updated_at': c.updated_at.isoformat() if c.updated_at else ''
            } for c in cheatsheets]
            groups = Group.query.filter_by(user_id=current_user.id).all()
            groups_list = [{'id': g.id, 'name': g.name, 'color': g.color} for g in groups]
            return render_template('index.html', cheatsheets=cs_list, groups=groups_list, edit_data=cs.data)
        return redirect(url_for('index'))

    @app.route('/preview/<cheatsheet_id>')
    @login_required
    def preview_cheatsheet(cheatsheet_id):
        """Preview a generated cheatsheet."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return 'Cheatsheet not found', 404
        html_content = generate_html(cs.data)
        return html_content

    @app.route('/download/<cheatsheet_id>')
    @login_required
    def download_cheatsheet(cheatsheet_id):
        """Download a cheatsheet as HTML file."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return 'Cheatsheet not found', 404

        html_content = generate_html(cs.data)
        safe_title = "".join(c for c in cs.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        filename = f"{safe_title}.html"

        return Response(
            html_content,
            mimetype='text/html',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )

    @app.route('/download-json/<cheatsheet_id>')
    @login_required
    def download_json(cheatsheet_id):
        """Download a cheatsheet as JSON file."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return 'Cheatsheet not found', 404

        import json
        json_content = json.dumps(cs.data, indent=2, ensure_ascii=False)
        safe_title = "".join(c for c in cs.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        filename = f"{safe_title}.json"

        return Response(
            json_content,
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )

    # ─── Public Sharing ──────────────────────────────────────────

    @app.route('/shared/<cheatsheet_id>')
    def shared_cheatsheet(cheatsheet_id):
        """View a publicly shared cheatsheet (no login required)."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, is_public=True).first()
        if not cs:
            return 'Cheatsheet not found or not public', 404
        html_content = generate_html(cs.data)
        return html_content

    # ─── Cheatsheet API ──────────────────────────────────────────

    @app.route('/api/cheatsheet', methods=['POST'])
    @login_required
    def create_cheatsheet():
        """Create or update a cheatsheet."""
        data = request.json

        cheatsheet_id = data.get('id')
        if not cheatsheet_id:
            title = data.get('title', 'Untitled')
            cheatsheet_id = generate_cheatsheet_id(title, current_user.id)

        now = datetime.utcnow()

        cheatsheet_data = {
            'id': cheatsheet_id,
            'title': data.get('title', 'Untitled'),
            'group': data.get('group', ''),
            'sections': data.get('sections', []),
            'created_at': data.get('created_at') or now.isoformat(),
            'updated_at': now.isoformat()
        }

        existing = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if existing:
            existing.title = cheatsheet_data['title']
            existing.data = cheatsheet_data
            existing.group_id = data.get('group') or None
            existing.updated_at = now
        else:
            cs = Cheatsheet(
                id=cheatsheet_id,
                user_id=current_user.id,
                title=cheatsheet_data['title'],
                data=cheatsheet_data,
                group_id=data.get('group') or None,
                created_at=now,
                updated_at=now
            )
            db.session.add(cs)

        db.session.commit()

        return jsonify({
            'success': True,
            'id': cheatsheet_id,
            'message': 'Cheatsheet saved successfully'
        })

    @app.route('/api/cheatsheet/<cheatsheet_id>', methods=['GET'])
    @login_required
    def get_cheatsheet(cheatsheet_id):
        """Get a cheatsheet by ID."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if cs:
            return jsonify(cs.data)
        return jsonify({'error': 'Cheatsheet not found'}), 404

    @app.route('/api/cheatsheets', methods=['GET'])
    @login_required
    def get_cheatsheets():
        """List all cheatsheets for current user."""
        cheatsheets = Cheatsheet.query.filter_by(user_id=current_user.id)\
            .order_by(Cheatsheet.updated_at.desc()).all()
        return jsonify([{
            'id': c.id, 'title': c.title, 'group': c.group_id or '',
            'created_at': c.created_at.isoformat() if c.created_at else '',
            'updated_at': c.updated_at.isoformat() if c.updated_at else ''
        } for c in cheatsheets])

    @app.route('/api/cheatsheet/<cheatsheet_id>', methods=['DELETE'])
    @login_required
    def delete_cheatsheet(cheatsheet_id):
        """Delete a cheatsheet and its associated images."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return jsonify({'error': 'Cheatsheet not found'}), 404

        db.session.delete(cs)  # Cascade deletes images
        db.session.commit()
        return jsonify({'success': True, 'message': 'Cheatsheet deleted'})

    @app.route('/api/cheatsheet/<cheatsheet_id>/group', methods=['PUT'])
    @login_required
    def update_cheatsheet_group(cheatsheet_id):
        """Update a cheatsheet's group assignment."""
        data = request.json
        group_id = data.get('group', '')

        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return jsonify({'error': 'Cheatsheet not found'}), 404

        cs.group_id = group_id or None
        # Also update in the JSON data
        cs_data = cs.data.copy()
        cs_data['group'] = group_id
        cs.data = cs_data
        db.session.commit()

        return jsonify({'success': True})

    @app.route('/api/cheatsheet/<cheatsheet_id>/share', methods=['PUT'])
    @login_required
    def toggle_share(cheatsheet_id):
        """Toggle public sharing for a cheatsheet."""
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return jsonify({'error': 'Cheatsheet not found'}), 404

        cs.is_public = not cs.is_public
        db.session.commit()

        share_url = url_for('shared_cheatsheet', cheatsheet_id=cheatsheet_id, _external=True) if cs.is_public else None
        return jsonify({
            'success': True,
            'is_public': cs.is_public,
            'share_url': share_url
        })

    # ─── Groups API ──────────────────────────────────────────────

    @app.route('/api/groups', methods=['GET'])
    @login_required
    def get_groups():
        """Get all groups for current user."""
        groups = Group.query.filter_by(user_id=current_user.id).all()
        return jsonify([{'id': g.id, 'name': g.name, 'color': g.color} for g in groups])

    @app.route('/api/groups', methods=['POST'])
    @login_required
    def create_group():
        """Create a new group."""
        data = request.json
        name = data.get('name', '').strip()

        if not name:
            return jsonify({'error': 'Group name is required'}), 400

        existing = Group.query.filter_by(user_id=current_user.id).all()
        if any(g.name.lower() == name.lower() for g in existing):
            return jsonify({'error': 'Group already exists'}), 400

        group_id = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())[:20]
        group_id = f"{group_id}_{hashlib.md5(f'{current_user.id}:{name}'.encode()).hexdigest()[:4]}"

        new_group = Group(
            id=group_id,
            user_id=current_user.id,
            name=name,
            color=data.get('color', '#667eea')
        )
        db.session.add(new_group)
        db.session.commit()

        return jsonify({'success': True, 'group': {'id': group_id, 'name': name, 'color': new_group.color}})

    @app.route('/api/groups/<group_id>', methods=['PUT'])
    @login_required
    def update_group(group_id):
        """Update a group."""
        data = request.json
        group = Group.query.filter_by(id=group_id, user_id=current_user.id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if 'name' in data:
            group.name = data['name']
        if 'color' in data:
            group.color = data['color']
        db.session.commit()

        return jsonify({'success': True, 'group': {'id': group.id, 'name': group.name, 'color': group.color}})

    @app.route('/api/groups/<group_id>', methods=['DELETE'])
    @login_required
    def delete_group(group_id):
        """Delete a group and unassign all cheatsheets from it."""
        group = Group.query.filter_by(id=group_id, user_id=current_user.id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Unassign cheatsheets (SET NULL handled by FK, but also update JSON data)
        for cs in Cheatsheet.query.filter_by(group_id=group_id, user_id=current_user.id).all():
            cs.group_id = None
            cs_data = cs.data.copy()
            cs_data['group'] = ''
            cs.data = cs_data

        db.session.delete(group)
        db.session.commit()

        return jsonify({'success': True})

    # ─── Images API ──────────────────────────────────────────────

    @app.route('/images/<cheatsheet_id>/<filename>')
    def serve_image(cheatsheet_id, filename):
        """Serve an image from the database."""
        # Check if cheatsheet is public or belongs to current user
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id).first()
        if not cs:
            return 'Not found', 404

        if not cs.is_public:
            if not current_user.is_authenticated or cs.user_id != current_user.id:
                return 'Not found', 404

        image = Image.query.filter_by(cheatsheet_id=cheatsheet_id, filename=filename).first()
        if not image:
            return 'Image not found', 404

        return send_file(BytesIO(image.data), mimetype=image.content_type, download_name=filename)

    @app.route('/api/cheatsheet/<cheatsheet_id>/image', methods=['POST'])
    @login_required
    def upload_image(cheatsheet_id):
        """Upload an image for a cheatsheet."""
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if not file.filename or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_image_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp, svg'}), 400

        original_filename = secure_filename(file.filename) or 'image.png'
        filename = generate_image_filename(original_filename)
        image_data = file.read()

        image = Image(
            cheatsheet_id=cheatsheet_id,
            filename=filename,
            data=image_data,
            content_type=file.content_type or 'image/png'
        )
        db.session.add(image)
        db.session.commit()

        url = f"/images/{cheatsheet_id}/{filename}"
        return jsonify({
            'success': True,
            'url': url,
            'filename': filename
        })

    @app.route('/api/cheatsheet/<cheatsheet_id>/image/<filename>', methods=['DELETE'])
    @login_required
    def delete_image(cheatsheet_id, filename):
        """Delete a specific image from a cheatsheet."""
        # Verify ownership
        cs = Cheatsheet.query.filter_by(id=cheatsheet_id, user_id=current_user.id).first()
        if not cs:
            return jsonify({'error': 'Cheatsheet not found'}), 404

        image = Image.query.filter_by(cheatsheet_id=cheatsheet_id, filename=filename).first()
        if not image:
            return jsonify({'error': 'Image not found'}), 404

        db.session.delete(image)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Image deleted'})


# Create app instance
app = create_app()

if __name__ == '__main__':
    print("CheatSheet Maker running at http://localhost:5000")
    app.run(debug=True, port=5000)
