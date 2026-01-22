import json
from bs4 import BeautifulSoup
import os

def parse_cheatsheet_html(html_content):
    """
    Parse the Git cheatsheet HTML and extract structured data
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract title from the header
    title = soup.find('div', class_='header').h1.text.strip()
    
    # Parse sections
    sections = []
    section_elements = soup.find_all('div', class_='section')
    
    for section in section_elements:
        section_data = parse_section(section)
        if section_data:
            sections.append(section_data)
    
    return {
        "title": title,
        "sections": sections
    }

def parse_section(section_element):
    """
    Parse a single section element
    """
    # Extract section title and number
    section_header = section_element.find('div', class_='section-header')
    if not section_header:
        return None
    
    section_number = section_header.find('div', class_='section-number').text.strip()
    section_title = section_header.find('div', class_='section-title').text.strip()
    
    # Get section content
    section_content = section_element.find('div', class_='section-content')
    if not section_content:
        return None
    
    # Parse description (first text-line in section)
    description = ""
    first_text_line = section_content.find('div', class_='text-line')
    if first_text_line:
        description = first_text_line.text.strip()
    
    # Parse images in section
    images = parse_images(section_content)
    
    # Parse code and text lines
    lines = parse_section_lines(section_content)
    
    # Parse subsections
    subsections = []
    subsections_grid = section_content.find('div', class_='subsections-grid')
    if subsections_grid:
        subsection_elements = subsections_grid.find_all('div', class_='subsection')
        for subsection in subsection_elements:
            subsection_data = parse_subsection(subsection)
            if subsection_data:
                subsections.append(subsection_data)
    
    return {
        "title": f"{section_number}. {section_title}",
        "description": description,
        "images": images,
        "lines": lines,
        "subsections": subsections
    }

def parse_subsection(subsection_element):
    """
    Parse a single subsection element
    """
    subsection_header = subsection_element.find('div', class_='subsection-header')
    if not subsection_header:
        return None
    
    subsection_number = subsection_header.find('div', class_='subsection-number').text.strip()
    subsection_title = subsection_header.find('div', class_='subsection-title').text.strip()
    
    subsection_content = subsection_element.find('div', class_='subsection-content')
    if not subsection_content:
        return None
    
    # Parse images in subsection
    images = parse_images(subsection_content)
    
    # Parse code and text lines
    lines = parse_subsection_lines(subsection_content)
    
    return {
        "title": f"{subsection_number} {subsection_title}",
        "images": images,
        "lines": lines
    }

def parse_images(content_element):
    """
    Parse images from a content element
    """
    images = []
    
    # Look for section images
    image_containers = content_element.find_all(['div'], class_=['section-image-container', 'subsection-image-container'])
    
    for container in image_containers:
        img = container.find('img')
        if img and img.get('src'):
            # Extract width percentage (default to 100 if not specified)
            width_percent = 100
            if 'zoomable' in img.get('class', []):
                # Try to extract width from style or class
                style = img.get('style', '')
                if 'width:' in style:
                    try:
                        width_str = style.split('width:')[1].split('%')[0].strip()
                        width_percent = int(width_str)
                    except:
                        pass
            
            images.append({
                "src": img['src'],
                "widthPercent": width_percent
            })
    
    return images

def parse_section_lines(content_element):
    """
    Parse code and text lines from section content
    """
    lines = []
    
    # Get all direct children of section content
    for child in content_element.children:
        if hasattr(child, 'name'):
            if child.name == 'div':
                if 'text-line' in child.get('class', []):
                    # Parse text line
                    lines.append({
                        "type": "text",
                        "text": child.text.strip()
                    })
                elif 'code-line' in child.get('class', []):
                    # Parse code line
                    code_line_data = parse_code_line(child)
                    if code_line_data:
                        lines.append(code_line_data)
    
    return lines

def parse_subsection_lines(content_element):
    """
    Parse code and text lines from subsection content
    """
    lines = []
    
    # Get all direct children of subsection content
    for child in content_element.children:
        if hasattr(child, 'name'):
            if child.name == 'div':
                if 'text-line' in child.get('class', []):
                    # Parse text line
                    lines.append({
                        "type": "text",
                        "text": child.text.strip()
                    })
                elif 'code-line' in child.get('class', []):
                    # Parse code line
                    code_line_data = parse_code_line(child)
                    if code_line_data:
                        lines.append(code_line_data)
    
    return lines

def parse_code_line(code_line_element):
    """
    Parse a single code line element
    """
    # Find the code command text
    code_command = code_line_element.find('span', class_='code-command')
    if not code_command:
        return None
    
    # Find the comment
    code_comment = code_line_element.find('span', class_='code-comment')
    comment_text = code_comment.text.strip() if code_comment else ""
    
    # Clean up the command text (remove HTML tags from within)
    command_text = ''
    for element in code_command.descendants:
        if isinstance(element, str):
            command_text += element.strip()
        elif element.name == 'span':
            # Add the content of nested spans
            if element.string:
                command_text += element.string.strip()
    
    return {
        "command": command_text.strip(),
        "comment": comment_text
    }

def extract_index_descriptions(html_content):
    """
    Extract section descriptions from the index for better metadata
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    index_section = soup.find('div', class_='index-section')
    if not index_section:
        return {}
    
    descriptions = {}
    index_list = index_section.find('ul', class_='index-list')
    
    if index_list:
        for li in index_list.find_all('li'):
            link = li.find('a')
            if link:
                # Extract section number from href
                href = link.get('href', '')
                if href.startswith('#section-'):
                    section_num = href.replace('#section-', '')
                    # Extract description from the span
                    desc_span = li.find('span', class_='index-description')
                    if desc_span:
                        descriptions[section_num] = desc_span.text.strip()
    
    return descriptions

def parse_with_index_descriptions(html_content):
    """
    Parse the cheatsheet with index descriptions
    """
    # First parse the main structure
    result = parse_cheatsheet_html(html_content)
    
    # Extract index descriptions
    index_descriptions = extract_index_descriptions(html_content)
    
    # Update section descriptions with index descriptions
    for section in result['sections']:
        # Extract section number from title (e.g., "1. Setup and Configuration" -> "1")
        title_parts = section['title'].split('.', 1)
        if len(title_parts) > 0:
            section_num = title_parts[0].strip()
            if section_num in index_descriptions:
                section['description'] = index_descriptions[section_num]
    
    return result

def main(path_to_html='Git_Cheatsheet.html',path_to_json='cheatsheet_structure.json'):
    """
    Main function to read HTML and output JSON
    """
    # Read the HTML file
    with open(path_to_html, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Parse the HTML with index descriptions
    parsed_data = parse_with_index_descriptions(html_content)
    
    # Save to JSON file
    with open(path_to_json, 'w', encoding='utf-8') as f:
        json.dump(parsed_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully extracted {len(parsed_data['sections'])} sections to {path_to_json}")
    
    # Print some statistics
    total_lines = 0
    total_subsections = 0
    total_images = 0
    
    for section in parsed_data['sections']:
        total_lines += len(section['lines'])
        total_subsections += len(section['subsections'])
        total_images += len(section['images'])
        for subsection in section['subsections']:
            total_lines += len(subsection['lines'])
            total_images += len(subsection['images'])
    
    print(f"Total lines: {total_lines}")
    print(f"Total subsections: {total_subsections}")
    print(f"Total images: {total_images}")

if __name__ == "__main__":
    path_current_dir = os.getcwd()
    main(path_to_html=os.path.join(path_current_dir, 'cheatsheets', 'Git_Cheatsheet.html'),
         path_to_json=os.path.join(path_current_dir, 'data', 'git_cheatsheet.json'))