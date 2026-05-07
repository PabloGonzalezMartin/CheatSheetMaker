import json
from pathlib import Path
from datetime import datetime
from app.models import Cheatsheet


DEMO_CHEATSHEET_ID = "welcome_to_cheatsheetmaker"
DEMO_CHEATSHEET_ES_ID = "bienvenido_a_cheatsheetmaker"
_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"


def _load_demo(filename: str, cheatsheet_id: str, now: datetime) -> dict:
    raw = json.loads((_PROMPTS_DIR / filename).read_text(encoding="utf-8"))
    return {
        **raw,
        "id": cheatsheet_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


def create_demo_cheatsheet(user_id: int, db) -> None:
    """Insert the welcome cheatsheets (EN + ES) for a newly registered user."""
    now = datetime.utcnow()

    demos = [
        ("example_welcome.json", DEMO_CHEATSHEET_ID),
        ("example_bienvenido.json", DEMO_CHEATSHEET_ES_ID),
    ]

    for filename, cs_id in demos:
        data = _load_demo(filename, cs_id, now)
        cs = Cheatsheet(
            id=cs_id,
            user_id=user_id,
            title=data["title"],
            data=data,
            group_id=None,
            created_at=now,
            updated_at=now,
        )
        db.add(cs)
    # caller commits
