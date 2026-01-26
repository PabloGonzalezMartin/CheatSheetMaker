"""
Migration script to convert base64 images in JSON files to separate image files.

This script:
1. Scans all cheatsheet JSON files in the data/ directory
2. Extracts base64 images and saves them to images/{cheatsheet_id}/
3. Updates the JSON files to use URL paths instead of base64

Usage:
    python migrate_images.py

Options:
    --dry-run    Preview changes without making them
    --backup     Create backup of JSON files before modification
"""

import os
import re
import sys
import json
import base64
import shutil
import hashlib
from datetime import datetime

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
IMAGES_DIR = os.path.join(BASE_DIR, 'images')
BACKUP_DIR = os.path.join(BASE_DIR, 'data_backup')


def is_base64_image(src):
    """Check if the src is a base64 encoded image."""
    return src and isinstance(src, str) and src.startswith('data:image')


def extract_mime_and_data(base64_string):
    """Extract MIME type and base64 data from a data URI."""
    # Format: data:image/png;base64,iVBORw0...
    match = re.match(r'data:image/([^;]+);base64,(.+)', base64_string)
    if match:
        image_type = match.group(1)
        data = match.group(2)
        return image_type, data
    return 'png', base64_string


def save_image_file(base64_string, images_dir, filename_prefix, index):
    """Save a base64 image to a file and return the URL path."""
    image_type, data = extract_mime_and_data(base64_string)

    # Map image types to extensions
    ext_map = {
        'png': 'png',
        'jpeg': 'jpg',
        'jpg': 'jpg',
        'gif': 'gif',
        'webp': 'webp',
        'svg+xml': 'svg'
    }
    ext = ext_map.get(image_type, 'png')

    filename = f"{filename_prefix}_{index}.{ext}"
    file_path = os.path.join(images_dir, filename)

    # Decode and save
    try:
        image_data = base64.b64decode(data)
        with open(file_path, 'wb') as f:
            f.write(image_data)
        return filename
    except Exception as e:
        print(f"  Error saving image: {e}")
        return None


def migrate_images_in_section(section, section_idx, cheatsheet_id, images_dir, dry_run=False):
    """Migrate images in a section (and its subsections) from base64 to files."""
    changes = []

    # Process section images
    images = section.get('images', [])
    if not images and section.get('image'):
        images = [section['image']]
        section['images'] = images
        if 'image' in section:
            del section['image']

    new_images = []
    for img_idx, image_data in enumerate(images):
        if isinstance(image_data, str):
            src = image_data
            width_percent = None
        else:
            src = image_data.get('src', '')
            width_percent = image_data.get('widthPercent')

        if is_base64_image(src):
            filename_prefix = f"section_{section_idx}_img"
            if not dry_run:
                filename = save_image_file(src, images_dir, filename_prefix, img_idx)
                if filename:
                    url_path = f"/images/{cheatsheet_id}/{filename}"
                    new_image = {'src': url_path}
                    if width_percent:
                        new_image['widthPercent'] = width_percent
                    new_images.append(new_image)
                    changes.append(f"  Section {section_idx}: Converted image {img_idx + 1}")
                else:
                    new_images.append(image_data)  # Keep original on error
            else:
                changes.append(f"  Section {section_idx}: Would convert image {img_idx + 1}")
                new_images.append(image_data)
        else:
            new_images.append(image_data)  # Keep non-base64 images

    section['images'] = new_images

    # Process subsections
    for sub_idx, subsection in enumerate(section.get('subsections', [])):
        sub_images = subsection.get('images', [])
        if not sub_images and subsection.get('image'):
            sub_images = [subsection['image']]
            subsection['images'] = sub_images
            if 'image' in subsection:
                del subsection['image']

        new_sub_images = []
        for img_idx, image_data in enumerate(sub_images):
            if isinstance(image_data, str):
                src = image_data
                width_percent = None
            else:
                src = image_data.get('src', '')
                width_percent = image_data.get('widthPercent')

            if is_base64_image(src):
                filename_prefix = f"section_{section_idx}_sub_{sub_idx}_img"
                if not dry_run:
                    filename = save_image_file(src, images_dir, filename_prefix, img_idx)
                    if filename:
                        url_path = f"/images/{cheatsheet_id}/{filename}"
                        new_image = {'src': url_path}
                        if width_percent:
                            new_image['widthPercent'] = width_percent
                        new_sub_images.append(new_image)
                        changes.append(f"  Section {section_idx}.{sub_idx}: Converted image {img_idx + 1}")
                    else:
                        new_sub_images.append(image_data)
                else:
                    changes.append(f"  Section {section_idx}.{sub_idx}: Would convert image {img_idx + 1}")
                    new_sub_images.append(image_data)
            else:
                new_sub_images.append(image_data)

        subsection['images'] = new_sub_images

    return changes


def migrate_cheatsheet(json_path, dry_run=False, backup=False):
    """Migrate all base64 images in a cheatsheet to files."""
    filename = os.path.basename(json_path)
    cheatsheet_id = filename[:-5]  # Remove .json

    print(f"\nProcessing: {filename}")

    # Load the cheatsheet data
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Create images directory for this cheatsheet
    images_dir = os.path.join(IMAGES_DIR, cheatsheet_id)
    if not dry_run:
        os.makedirs(images_dir, exist_ok=True)

    # Process all sections
    all_changes = []
    for section_idx, section in enumerate(data.get('sections', [])):
        changes = migrate_images_in_section(
            section, section_idx, cheatsheet_id, images_dir, dry_run
        )
        all_changes.extend(changes)

    if not all_changes:
        print("  No base64 images found - skipping")
        return 0

    # Print changes
    for change in all_changes:
        print(change)

    if not dry_run:
        # Backup original file if requested
        if backup:
            os.makedirs(BACKUP_DIR, exist_ok=True)
            backup_path = os.path.join(BACKUP_DIR, filename)
            shutil.copy2(json_path, backup_path)
            print(f"  Backed up to: {backup_path}")

        # Save updated JSON
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Updated JSON file")

    return len(all_changes)


def main():
    # Parse arguments
    dry_run = '--dry-run' in sys.argv
    backup = '--backup' in sys.argv

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 60)

    if backup and not dry_run:
        print("Backup mode enabled - original files will be preserved")

    # Ensure images directory exists
    if not dry_run:
        os.makedirs(IMAGES_DIR, exist_ok=True)

    # Find all cheatsheet JSON files
    total_converted = 0
    files_processed = 0

    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json') and not filename.startswith('_'):
            json_path = os.path.join(DATA_DIR, filename)
            converted = migrate_cheatsheet(json_path, dry_run, backup)
            total_converted += converted
            files_processed += 1

    print("\n" + "=" * 60)
    print(f"Migration {'preview' if dry_run else 'complete'}!")
    print(f"Files processed: {files_processed}")
    print(f"Images {'would be ' if dry_run else ''}converted: {total_converted}")

    if dry_run:
        print("\nRun without --dry-run to apply changes")


if __name__ == '__main__':
    main()
