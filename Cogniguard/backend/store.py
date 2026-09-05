import json
import os
from datetime import datetime
from typing import Any, Dict


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "store.json")


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _default_store() -> Dict[str, Any]:
    return {
        "users": [
            {
                "id": 1,
                "name": "Admin",
                "email": "admin@cogniguard.local",
                "password": "cogni@123",
                "role": "admin",
                "age": None,
                "gender": "prefer_not_to_say",
                "phone": "",
                "city": "",
                "emergency_contact": "",
                "emergency_email": "",
                "family_history": "unknown",
                "memory_issues": "unknown",
                "occupation": "",
                "education": "",
                "address": "",
                "medical_notes": "",
                "profile_pic": "",
                "is_active": True,
                "created_at": _now_iso(),
                "last_used_at": None,
            }
        ],
        "sessions": [],
        "reports": [],
        "feedback": [],
        "memory_entries": [],
        "test_config": {
            "word_bank": [
                "River", "Lamp", "Garden", "Mirror", "Pencil", "Tiger", "Window", "Orange", "Bridge", "Feather",
                "Mountain", "Clock", "Butterfly", "Teacup", "Library", "Ocean", "Temple", "Camera", "Parrot", "Rainbow",
            ],
            "number_bank": ["3", "7", "12", "19", "24", "31", "45", "58", "64", "72", "88", "91", "26", "39", "47", "53", "67", "75"],
            "memory_prompts": {
                "childhood": "Tell me about a childhood memory that still feels vivid to you.",
                "adult": "Tell me about a meaningful memory from your adult life.",
                "recent": "Tell me about a recent memory from the past few weeks that you can recall easily.",
            },
        },
        "counters": {"user": 2, "session": 1, "report": 1, "feedback": 1, "memory": 1},
    }


def load_store() -> Dict[str, Any]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        data = _default_store()
        save_store(data)
        return data

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    defaults = _default_store()
    if "test_config" not in data:
        data["test_config"] = defaults["test_config"]
        changed = True
    if "counters" not in data:
        data["counters"] = defaults["counters"]
        changed = True
    if "memory_entries" not in data:
        data["memory_entries"] = []
        changed = True
    if "memory" not in data.get("counters", {}):
        data["counters"]["memory"] = 1
        changed = True

    if changed:
        save_store(data)

    return data


def save_store(data: Dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def next_id(data: Dict[str, Any], key: str) -> int:
    value = int(data["counters"][key])
    data["counters"][key] = value + 1
    return value
