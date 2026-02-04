"""
One-time migration: import existing JSON/image files into PostgreSQL.

Usage:
    python migrate_to_db.py

This will:
1. Create a default user ("pablo") for existing data
2. Import all cheatsheets from data/*.json
3. Import all groups from data/_groups.json
4. Import all images from images/ directories
"""

import os
import json
from app import create_app
from models import db, User, Cheatsheet, Group, Image
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
IMAGES_DIR = os.path.join(BASE_DIR, 'images')

MIME_MAP = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
}

app = create_app()

with app.app_context():
    # Check if data directory exists
    if not os.path.exists(DATA_DIR):
        print("No data/ directory found. Nothing to migrate.")
        exit(0)

    # Create default user
    existing_user = User.query.filter_by(username='pablo').first()
    if existing_user:
        user = existing_user
        print(f"Using existing user: {user.username} (id={user.id})")
    else:
        user = User(
            username='pablo',
            email='pablo@cheatsheetmaker.com',
            password_hash=generate_password_hash('changeme')
        )
        db.session.add(user)
        db.session.flush()
        print(f"Created user: {user.username} (id={user.id})")
        print("  ** Default password is 'changeme' - change it after first login! **")

    # Import groups
    groups_file = os.path.join(DATA_DIR, '_groups.json')
    groups_imported = 0
    if os.path.exists(groups_file):
        with open(groups_file, 'r', encoding='utf-8') as f:
            groups_data = json.load(f)
        for g in groups_data:
            if not Group.query.filter_by(id=g['id']).first():
                db.session.add(Group(
                    id=g['id'],
                    user_id=user.id,
                    name=g['name'],
                    color=g.get('color', '#667eea')
                ))
                groups_imported += 1
    print(f"Imported {groups_imported} groups")

    # Import cheatsheets and images
    cheatsheets_imported = 0
    images_imported = 0

    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.endswith('.json') or fname.startswith('_'):
            continue

        cs_id = fname[:-5]

        # Skip if already exists
        if Cheatsheet.query.filter_by(id=cs_id).first():
            print(f"  Skipping (already exists): {cs_id}")
            continue

        with open(os.path.join(DATA_DIR, fname), 'r', encoding='utf-8') as f:
            data = json.load(f)

        group_id = data.get('group') or None
        # Verify group exists
        if group_id and not Group.query.filter_by(id=group_id).first():
            group_id = None

        cs = Cheatsheet(
            id=cs_id,
            user_id=user.id,
            title=data.get('title', 'Untitled'),
            data=data,
            group_id=group_id
        )
        db.session.add(cs)
        cheatsheets_imported += 1
        print(f"  Imported cheatsheet: {data.get('title', cs_id)}")

        # Import images for this cheatsheet
        img_dir = os.path.join(IMAGES_DIR, cs_id)
        if os.path.exists(img_dir):
            for img_fname in os.listdir(img_dir):
                img_path = os.path.join(img_dir, img_fname)
                if not os.path.isfile(img_path):
                    continue

                ext = img_fname.rsplit('.', 1)[-1].lower() if '.' in img_fname else 'png'
                content_type = MIME_MAP.get(ext, 'image/png')

                with open(img_path, 'rb') as imgf:
                    img_data = imgf.read()

                db.session.add(Image(
                    cheatsheet_id=cs_id,
                    filename=img_fname,
                    data=img_data,
                    content_type=content_type
                ))
                images_imported += 1

    db.session.commit()

    print(f"\nMigration complete!")
    print(f"  Cheatsheets: {cheatsheets_imported}")
    print(f"  Groups: {groups_imported}")
    print(f"  Images: {images_imported}")
