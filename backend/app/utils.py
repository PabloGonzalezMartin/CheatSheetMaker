import os
import re
import hashlib
from datetime import datetime

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff", "tif", "avif", "ico", "heic", "heif"}


def generate_cheatsheet_id(title: str, user_id: int | None = None) -> str:
    clean_title = re.sub(r"[^a-zA-Z0-9\s_-]", "", title.lower())
    clean_title = re.sub(r"\s+", "_", clean_title.strip())
    clean_title = clean_title[:30]
    hash_input = f"{user_id}:{title}" if user_id else title
    hash_str = hashlib.md5(hash_input.encode()).hexdigest()[:6]
    return f"{clean_title}_{hash_str}" if clean_title else hash_str


def allowed_image_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def generate_image_filename(original_filename: str) -> str:
    ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else "png"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_hash = hashlib.md5(os.urandom(16)).hexdigest()[:6]
    return f"img_{timestamp}_{random_hash}.{ext}"
