import json
import os
import sys
from pathlib import Path


def _bootstrap_backend_path():
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


_bootstrap_backend_path()

from memory_model import MEMORY_MODEL_PATH, train_memory_model_from_hf


def main():
    summary = train_memory_model_from_hf(dataset_id="MearaHe/dementiabank")
    print(json.dumps({
        "message": "memory_model_training_complete",
        "model_path": MEMORY_MODEL_PATH,
        **summary,
    }, indent=2))


if __name__ == "__main__":
    os.makedirs(os.path.dirname(MEMORY_MODEL_PATH), exist_ok=True)
    main()
