import argparse
import json
import os
import sys
from pathlib import Path


def _bootstrap_backend_path():
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


_bootstrap_backend_path()

from ml_pipeline import MODEL_PATH, train_and_save_model


def main():
    parser = argparse.ArgumentParser(description="Train CogniGuard risk model")
    parser.add_argument("--csv", dest="csv_path", default="", help="Optional CSV dataset path")
    args, _ = parser.parse_known_args()

    model = train_and_save_model(csv_path=args.csv_path)
    print(json.dumps({
        "message": "training_complete",
        "model_path": MODEL_PATH,
        "dataset_source": model.get("dataset_source"),
        "num_samples": model.get("num_samples"),
        "metrics": model.get("metrics"),
        "trained_at": model.get("trained_at"),
    }, indent=2))


if __name__ == "__main__":
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    main()
