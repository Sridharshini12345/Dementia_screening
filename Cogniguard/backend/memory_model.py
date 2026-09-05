import os
import re
from datetime import datetime
from typing import Dict

from joblib import dump, load
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "data", "models")
MEMORY_MODEL_PATH = os.path.join(MODEL_DIR, "memory_text_model.joblib")


def _clean_text(text: str) -> str:
    text = str(text or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    if text in {"nil", "null", "none", "n/a", "na", "undefined", "blank", "empty"}:
        return ""
    return text


def train_memory_model_from_hf(dataset_id: str = "MearaHe/dementiabank") -> Dict:
    from datasets import load_dataset

    ds = load_dataset(dataset_id)
    split = "train" if "train" in ds else list(ds.keys())[0]
    rows = ds[split]

    texts = []
    labels = []
    for row in rows:
        text = _clean_text(row.get("input", ""))
        label = str(row.get("output", "")).strip().lower()
        if not text:
            continue
        target = 1 if label == "control" else 0
        texts.append(text)
        labels.append(target)

    if not texts:
        raise ValueError("No usable text samples found in dataset")

    X_train, X_val, y_train, y_val = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    vectorizer = TfidfVectorizer(
        max_features=12000,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_val_vec = vectorizer.transform(X_val)

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_train_vec, y_train)

    val_acc = float(clf.score(X_val_vec, y_val))

    os.makedirs(MODEL_DIR, exist_ok=True)
    payload = {
        "model_type": "tfidf_logreg_memory_classifier",
        "dataset_source": dataset_id,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "metrics": {
            "val_accuracy": round(val_acc, 4),
        },
        "num_samples": len(texts),
        "vectorizer": vectorizer,
        "classifier": clf,
    }
    dump(payload, MEMORY_MODEL_PATH)

    return {
        "model_path": MEMORY_MODEL_PATH,
        "dataset_source": dataset_id,
        "num_samples": len(texts),
        "metrics": payload["metrics"],
        "trained_at": payload["trained_at"],
    }


def predict_memory_health_score(text: str) -> float:
    if not os.path.exists(MEMORY_MODEL_PATH):
        return 0.0

    cleaned = _clean_text(text)
    if not cleaned:
        return 0.0

    payload = load(MEMORY_MODEL_PATH)
    vectorizer = payload["vectorizer"]
    clf = payload["classifier"]

    x = vectorizer.transform([cleaned])
    prob_control = float(clf.predict_proba(x)[0][1])
    return max(0.0, min(1.0, round(prob_control, 4)))
