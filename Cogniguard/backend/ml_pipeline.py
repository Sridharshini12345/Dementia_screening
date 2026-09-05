import csv
import json
import math
import os
import random
from datetime import datetime
from typing import Dict, List, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "data", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "cognitive_risk_model.json")

FEATURE_ORDER = [
    "word_forward",
    "word_reverse",
    "number_forward",
    "number_reverse",
    "childhood",
    "adult",
    "recent",
    "adaptive",
    "transcript_word_count_norm",
    "transcript_unique_ratio",
]


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _sigmoid(x: float) -> float:
    if x < -60:
        return 0.0
    if x > 60:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def _text_features(transcript: str) -> Tuple[float, float]:
    words = [w.strip(".,!?;:()[]{}\"'").lower() for w in (transcript or "").split() if w.strip()]
    wc = len(words)
    unique_ratio = (len(set(words)) / wc) if wc else 0.0
    wc_norm = _clamp01(wc / 120.0)
    return wc_norm, unique_ratio


def featurize_sections(sections: Dict[str, float], transcript: str = "") -> List[float]:
    wc_norm, unique_ratio = _text_features(transcript)
    return [
        _clamp01(sections.get("word_forward", 0.0)),
        _clamp01(sections.get("word_reverse", 0.0)),
        _clamp01(sections.get("number_forward", 0.0)),
        _clamp01(sections.get("number_reverse", 0.0)),
        _clamp01(sections.get("childhood", 0.0)),
        _clamp01(sections.get("adult", 0.0)),
        _clamp01(sections.get("recent", 0.0)),
        _clamp01(sections.get("adaptive", 0.0)),
        _clamp01(wc_norm),
        _clamp01(unique_ratio),
    ]


def _proxy_sections_from_text(transcript: str) -> Dict[str, float]:
    words = [w.strip(".,!?;:()[]{}\"'").lower() for w in (transcript or "").split() if w.strip()]
    wc = len(words)
    unique_ratio = (len(set(words)) / wc) if wc else 0.0
    avg_len = (sum(len(w) for w in words) / wc) if wc else 0.0
    long_ratio = (sum(1 for w in words if len(w) >= 7) / wc) if wc else 0.0
    sentence_count = max(1, len([s for s in (transcript or "").split(".") if s.strip()]))
    sentence_norm = _clamp01(sentence_count / 6.0)
    wc_norm = _clamp01(wc / 120.0)
    avg_len_norm = _clamp01(avg_len / 7.5)

    return {
        "word_forward": _clamp01(0.35 * unique_ratio + 0.35 * wc_norm + 0.30 * avg_len_norm),
        "word_reverse": _clamp01(0.45 * unique_ratio + 0.25 * sentence_norm + 0.30 * avg_len_norm),
        "number_forward": _clamp01(0.25 * wc_norm + 0.35 * sentence_norm + 0.40 * unique_ratio),
        "number_reverse": _clamp01(0.35 * unique_ratio + 0.35 * sentence_norm + 0.30 * long_ratio),
        "childhood": _clamp01(0.50 * unique_ratio + 0.30 * long_ratio + 0.20 * wc_norm),
        "adult": _clamp01(0.45 * unique_ratio + 0.25 * avg_len_norm + 0.30 * wc_norm),
        "recent": _clamp01(0.40 * unique_ratio + 0.30 * sentence_norm + 0.30 * wc_norm),
        "adaptive": _clamp01(0.40 * unique_ratio + 0.35 * long_ratio + 0.25 * sentence_norm),
    }


def load_real_proxy_dataset_from_hf(dataset_id: str = "MearaHe/dementiabank") -> Tuple[List[List[float]], List[int]]:
    from datasets import load_dataset

    ds = load_dataset(dataset_id)
    split = "train" if "train" in ds else list(ds.keys())[0]

    X: List[List[float]] = []
    y: List[int] = []
    for row in ds[split]:
        transcript = str(row.get("input", "") or "").strip()
        label = str(row.get("output", "") or "").strip().lower()
        if not transcript:
            continue

        sections = _proxy_sections_from_text(transcript)
        X.append(featurize_sections(sections, transcript))
        y.append(0 if label == "control" else 1)

    if not X:
        raise ValueError("No rows available from real dataset")
    return X, y


def _linear(weights: List[float], bias: float, x: List[float]) -> float:
    return sum(w * xi for w, xi in zip(weights, x)) + bias


def train_logistic_regression(
    X: List[List[float]],
    y: List[int],
    epochs: int = 600,
    lr: float = 0.15,
) -> Dict:
    n_samples = len(X)
    n_features = len(X[0]) if n_samples else 0
    if n_samples == 0 or n_features == 0:
        raise ValueError("Empty training data")

    weights = [0.0] * n_features
    bias = 0.0

    for _ in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0

        for i in range(n_samples):
            z = _linear(weights, bias, X[i])
            pred = _sigmoid(z)
            err = pred - y[i]
            for j in range(n_features):
                grad_w[j] += err * X[i][j]
            grad_b += err

        inv_n = 1.0 / n_samples
        for j in range(n_features):
            weights[j] -= lr * grad_w[j] * inv_n
        bias -= lr * grad_b * inv_n

    return {"weights": weights, "bias": bias}


def evaluate_model(weights: List[float], bias: float, X: List[List[float]], y: List[int]) -> Dict[str, float]:
    if not X:
        return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0}

    tp = fp = tn = fn = 0
    for xi, yi in zip(X, y):
        pred_label = 1 if _sigmoid(_linear(weights, bias, xi)) >= 0.5 else 0
        if pred_label == 1 and yi == 1:
            tp += 1
        elif pred_label == 1 and yi == 0:
            fp += 1
        elif pred_label == 0 and yi == 0:
            tn += 1
        else:
            fn += 1

    total = len(y)
    accuracy = (tp + tn) / total if total else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
    }


def generate_synthetic_dataset(n: int = 1200, seed: int = 42) -> Tuple[List[List[float]], List[int]]:
    random.seed(seed)
    X: List[List[float]] = []
    raw_risks: List[float] = []

    for _ in range(n):
        sections = {
            "word_forward": random.uniform(0.1, 0.95),
            "word_reverse": random.uniform(0.05, 0.9),
            "number_forward": random.uniform(0.1, 0.95),
            "number_reverse": random.uniform(0.1, 0.95),
            "childhood": random.uniform(0.2, 0.95),
            "adult": random.uniform(0.1, 0.95),
            "recent": random.uniform(0.1, 0.95),
            "adaptive": random.uniform(0.15, 0.95),
        }
        transcript_len = random.randint(15, 180)
        unique_ratio = random.uniform(0.25, 0.95)
        transcript = " ".join([f"w{i%max(1, int(transcript_len * (1-unique_ratio) + 1))}" for i in range(transcript_len)])

        x = featurize_sections(sections, transcript)
        X.append(x)

        cognition_quality = (
            sections["word_forward"] * 0.18
            + sections["word_reverse"] * 0.18
            + sections["number_forward"] * 0.18
            + sections["number_reverse"] * 0.18
            + sections["childhood"] * 0.1
            + sections["adult"] * 0.1
            + sections["recent"] * 0.1
            + sections["adaptive"] * 0.08
        )
        text_bonus = 0.05 * x[8] + 0.05 * x[9]
        risk = _clamp01(1 - (cognition_quality + text_bonus) + random.uniform(-0.08, 0.08))
        raw_risks.append(risk)

    sorted_r = sorted(raw_risks)
    threshold = sorted_r[len(sorted_r) // 2] if sorted_r else 0.5
    y: List[int] = [1 if r >= threshold else 0 for r in raw_risks]

    return X, y


def load_dataset_from_csv(csv_path: str, label_col: str = "label") -> Tuple[List[List[float]], List[int]]:
    X: List[List[float]] = []
    y: List[int] = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sections = {
                "word_forward": float(row.get("word_forward", 0) or 0),
                "word_reverse": float(row.get("word_reverse", 0) or 0),
                "number_forward": float(row.get("number_forward", 0) or 0),
                "number_reverse": float(row.get("number_reverse", 0) or 0),
                "childhood": float(row.get("childhood", 0) or 0),
                "adult": float(row.get("adult", 0) or 0),
                "recent": float(row.get("recent", 0) or 0),
                "adaptive": float(row.get("adaptive", 0) or 0),
            }
            transcript = row.get("transcript", "") or ""
            X.append(featurize_sections(sections, transcript))
            y.append(int(float(row.get(label_col, 0) or 0)))

    return X, y


def _split_train_val(X: List[List[float]], y: List[int], val_ratio: float = 0.2) -> Tuple:
    idx = list(range(len(X)))
    random.shuffle(idx)
    cut = int(len(idx) * (1 - val_ratio))
    train_idx = idx[:cut]
    val_idx = idx[cut:]
    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_val = [X[i] for i in val_idx]
    y_val = [y[i] for i in val_idx]
    return X_train, y_train, X_val, y_val


def save_model(model: Dict, out_path: str = MODEL_PATH) -> str:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=2)
    return out_path


def load_model(path: str = MODEL_PATH) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def train_and_save_model(csv_path: str = "", epochs: int = 700, lr: float = 0.12) -> Dict:
    if csv_path and os.path.exists(csv_path):
        X, y = load_dataset_from_csv(csv_path)
        source = f"csv:{csv_path}"
    else:
        try:
            X, y = load_real_proxy_dataset_from_hf(dataset_id="MearaHe/dementiabank")
            source = "hf:MearaHe/dementiabank_proxy_tabular"
        except Exception:
            X, y = generate_synthetic_dataset(n=1400)
            source = "synthetic_fallback"

    X_train, y_train, X_val, y_val = _split_train_val(X, y)
    fitted = train_logistic_regression(X_train, y_train, epochs=epochs, lr=lr)
    metrics = evaluate_model(fitted["weights"], fitted["bias"], X_val, y_val)

    model = {
        "model_type": "logistic_regression_custom",
        "feature_order": FEATURE_ORDER,
        "weights": fitted["weights"],
        "bias": fitted["bias"],
        "metrics": metrics,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_source": source,
        "num_samples": len(X),
        "notes": "When no CSV is provided, training first tries a real tabular proxy built from DementiaBank transcripts.",
    }
    save_model(model)
    return model


def predict_risk(sections: Dict[str, float], transcript: str = "", model_path: str = MODEL_PATH) -> float:
    if not os.path.exists(model_path):
        raise FileNotFoundError("Trained model not found. Run training first.")
    model = load_model(model_path)
    x = featurize_sections(sections, transcript)
    prob_high_risk = _sigmoid(_linear(model["weights"], float(model["bias"]), x))
    return round(_clamp01(prob_high_risk), 3)
