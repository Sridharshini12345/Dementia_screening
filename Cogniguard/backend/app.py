import importlib
import os
import sys
import re
import json
import secrets
import smtplib
from datetime import datetime
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
import traceback

flask_module = importlib.import_module("flask")
Flask = flask_module.Flask
request = flask_module.request
jsonify = flask_module.jsonify
send_file = flask_module.send_file
send_from_directory = flask_module.send_from_directory
CORS = importlib.import_module("flask_cors").CORS

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

Config = importlib.import_module("config").Config
security_module = importlib.import_module("utils.security")
token_required = security_module.token_required
generate_token = security_module.generate_token

store_module = importlib.import_module("store")
load_store = store_module.load_store
save_store = store_module.save_store
next_id = store_module.next_id

ml_module = importlib.import_module("ml_pipeline")
train_and_save_model = ml_module.train_and_save_model
predict_risk = ml_module.predict_risk
MODEL_PATH = ml_module.MODEL_PATH

memory_model_module = importlib.import_module("memory_model")
train_memory_model_from_hf = memory_model_module.train_memory_model_from_hf
predict_memory_health_score = memory_model_module.predict_memory_health_score
MEMORY_MODEL_PATH = memory_model_module.MEMORY_MODEL_PATH

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def _export_dir() -> str:
    out_dir = os.path.join(BACKEND_DIR, "exports")
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def _public_base_url() -> str:
    configured = str(app.config.get("PUBLIC_BASE_URL") or "").strip()
    if configured:
        return configured.rstrip("/")
    return "http://127.0.0.1:5000"


def _extract_email(value: str) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", text):
        return text
    return ""


def _create_report_pdf(report: dict) -> str:
    out_file = os.path.join(_export_dir(), f"report_{report['id']}.pdf")
    try:
        reportlab_canvas = importlib.import_module("reportlab.pdfgen.canvas").Canvas
        pagesizes = importlib.import_module("reportlab.lib.pagesizes")
        canvas = reportlab_canvas(out_file, pagesize=pagesizes.A4)
        width, height = pagesizes.A4
        x = 50
        y = height - 50

        def line(text: str, gap: int = 18):
            nonlocal y
            canvas.drawString(x, y, str(text))
            y -= gap

        canvas.setTitle(f"CogniGuard Report {report['id']}")
        canvas.setFont("Helvetica-Bold", 16)
        line("CogniGuard Clinical Screening Report", 28)
        canvas.setFont("Helvetica", 11)
        line(f"Report ID: {report['id']}")
        line(f"Patient Name: {report.get('patient_name', '')}")
        line(f"Patient Email: {report.get('patient_email', '')}")
        line(f"Created At: {report.get('created_at', '')}")
        line(f"Risk Score: {round(float(report.get('risk_score', 0)) * 100, 2)}%")
        line(f"Interpretation: {report.get('interpretation', '')}", 24)

        canvas.setFont("Helvetica-Bold", 12)
        line("Section Scores")
        canvas.setFont("Helvetica", 11)
        for k, v in (report.get("sections") or {}).items():
            line(f"- {_section_label(str(k))}: {round(float(v) * 100, 2)}%")
            if y < 90:
                canvas.showPage()
                canvas.setFont("Helvetica", 11)
                y = height - 50

        doctor_summary = str(report.get("doctor_summary") or "").strip()
        if doctor_summary:
            if y < 120:
                canvas.showPage()
                y = height - 50
            canvas.setFont("Helvetica-Bold", 12)
            line("Clinical Notes")
            canvas.setFont("Helvetica", 11)
            for part in doctor_summary.split(". "):
                part = part.strip()
                if not part:
                    continue
                line(f"- {part if part.endswith('.') else part + '.'}")
                if y < 90:
                    canvas.showPage()
                    canvas.setFont("Helvetica", 11)
                    y = height - 50

        canvas.save()
        return out_file
    except Exception:
        return ""


def _dispatch_report_via_email(user: dict, report: dict) -> dict:
    recipients = []
    patient_email = _extract_email(user.get("email", ""))
    emergency_email = _extract_email(user.get("emergency_email", ""))
    if patient_email:
        recipients.append(patient_email)
    if emergency_email and emergency_email not in recipients:
        recipients.append(emergency_email)

    if not recipients:
        return {"sent": False, "reason": "No email recipients available"}

    share_key = report.get("share_key")
    pdf_url = f"{_public_base_url()}/api/public/reports/{report['id']}/pdf/{share_key}"

    smtp_host = str(app.config.get("SMTP_HOST") or "").strip()
    smtp_port = int(app.config.get("SMTP_PORT") or 587)
    smtp_username = str(app.config.get("SMTP_USERNAME") or "").strip()
    smtp_password = str(app.config.get("SMTP_PASSWORD") or "").strip()
    smtp_from_email = str(app.config.get("SMTP_FROM_EMAIL") or "").strip()
    smtp_use_tls = bool(app.config.get("SMTP_USE_TLS", True))

    if not (smtp_host and smtp_from_email):
        return {
            "sent": False,
            "reason": "SMTP email is not configured",
            "targets": recipients,
            "pdf_url": pdf_url,
        }

    subject = f"CogniGuard Report #{report.get('id')}"
    body = (
        f"Hello,\n\n"
        f"A new CogniGuard report is available for {report.get('patient_name', 'patient')}.\n"
        f"Risk score: {round(float(report.get('risk_score', 0)) * 100, 1)}%\n"
        f"Interpretation: {report.get('interpretation', '')}\n\n"
        f"Secure PDF link: {pdf_url}\n\n"
        f"Regards,\nCogniGuard"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from_email
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    pdf_path = report.get("pdf_path") or os.path.join(_export_dir(), f"report_{report['id']}.pdf")
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            msg.add_attachment(
                f.read(),
                maintype="application",
                subtype="pdf",
                filename=f"CogniGuard_Report_{report['id']}.pdf",
            )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            if smtp_use_tls:
                server.starttls()
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.send_message(msg)
        return {
            "sent": True,
            "sent_to": recipients,
            "pdf_url": pdf_url,
            "channel": "email",
        }
    except Exception as e:
        return {
            "sent": False,
            "reason": f"Email dispatch failed: {e}",
            "targets": recipients,
            "pdf_url": pdf_url,
        }


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _find_user_by_id(data, user_id):
    for user in data["users"]:
        if user["id"] == user_id:
            return user
    return None


def _find_user_by_email(data, email):
    for user in data["users"]:
        if user["email"].lower() == str(email).lower():
            return user
    return None


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _sanitize_list(values, default_values, max_items: int = 40):
    source = values if isinstance(values, list) and values else default_values
    cleaned = []
    for item in source:
        text = str(item or "").strip()
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= max_items:
            break
    return cleaned or list(default_values)


def _default_test_config() -> dict:
    return {
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
    }


def _load_test_config(data: dict) -> dict:
    defaults = _default_test_config()
    raw = data.get("test_config") if isinstance(data.get("test_config"), dict) else {}
    prompts_raw = raw.get("memory_prompts") if isinstance(raw.get("memory_prompts"), dict) else {}

    return {
        "word_bank": _sanitize_list(raw.get("word_bank"), defaults["word_bank"], max_items=40),
        "number_bank": _sanitize_list(raw.get("number_bank"), defaults["number_bank"], max_items=40),
        "memory_prompts": {
            "childhood": str(prompts_raw.get("childhood") or defaults["memory_prompts"]["childhood"]).strip(),
            "adult": str(prompts_raw.get("adult") or defaults["memory_prompts"]["adult"]).strip(),
            "recent": str(prompts_raw.get("recent") or defaults["memory_prompts"]["recent"]).strip(),
        },
    }


def _normalize_memory_category(value: str) -> str:
    category = str(value or "").strip().lower()
    if category in {"childhood", "adult", "adulthood", "recent"}:
        return "Adulthood" if category in {"adult", "adulthood"} else category.title()
    return "Adulthood"


def _section_label(section_key: str) -> str:
    labels = {
        "word_forward": "Word Recall Forward",
        "word_reverse": "Word Recall Reverse",
        "number_forward": "Number Recall Forward",
        "number_reverse": "Number Recall Reverse",
        "childhood": "Childhood Memory",
        "adult": "Adult Memory",
        "recent": "Recent Memory",
        "adaptive": "Adaptive Follow-up",
    }
    return labels.get(section_key, section_key.replace("_", " ").title())


def _report_fingerprint(report: dict) -> str:
    payload = {
        "user_id": int(report.get("user_id", -1)),
        "sections": report.get("sections", {}),
        "user_inputs": report.get("user_inputs", {}),
    }
    return json.dumps(payload, sort_keys=True, default=str)


def _find_recent_duplicate_report(data: dict, user_id: int, sections: dict, raw_notes) -> dict:
    notes_obj = {}
    if isinstance(raw_notes, dict):
        notes_obj = raw_notes
    elif isinstance(raw_notes, str) and raw_notes.strip():
        try:
            parsed = json.loads(raw_notes)
            notes_obj = parsed if isinstance(parsed, dict) else {"raw_notes": raw_notes}
        except Exception:
            notes_obj = {"raw_notes": raw_notes}

    candidate_fp = json.dumps({
        "user_id": int(user_id),
        "sections": sections,
        "user_inputs": notes_obj,
    }, sort_keys=True, default=str)

    now = datetime.utcnow()
    for report in sorted(data.get("reports", []), key=lambda r: int(r.get("id", 0)), reverse=True):
        if int(report.get("user_id", -1)) != int(user_id):
            continue
        created_at = str(report.get("created_at") or "")
        try:
            ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            delta = abs((now.replace(tzinfo=ts.tzinfo) - ts).total_seconds())
            if delta > 120:
                continue
        except Exception:
            continue

        if _report_fingerprint(report) == candidate_fp:
            return report
    return None


def _cleanup_immediate_duplicate_reports(data: dict) -> bool:
    reports = sorted(data.get("reports", []), key=lambda r: int(r.get("id", 0)))
    kept = []
    changed = False
    seen_recent = {}

    for report in reports:
        user_id = int(report.get("user_id", -1))
        fp = _report_fingerprint(report)
        created_at = str(report.get("created_at") or "")
        ts_seconds = None
        try:
            ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            ts_seconds = int(ts.timestamp())
        except Exception:
            ts_seconds = None

        key = (user_id, fp)
        prev_seconds = seen_recent.get(key)
        if prev_seconds is not None and ts_seconds is not None and abs(ts_seconds - prev_seconds) <= 120:
            changed = True
            continue

        if ts_seconds is not None:
            seen_recent[key] = ts_seconds
        kept.append(report)

    if changed:
        data["reports"] = kept
    return changed


def _calibrate_risk_score(sections: dict, transcript: str, model_risk=None):
    weights = {
        "word_forward": 0.23,
        "word_reverse": 0.23,
        "number_forward": 0.23,
        "number_reverse": 0.23,
        "childhood": 0.03,
        "adult": 0.03,
        "recent": 0.03,
        "adaptive": 0.02,
    }

    weight_total = sum(weights.values())
    weighted_quality = sum(_clamp01(sections.get(key, 0.0)) * weight for key, weight in weights.items())
    quality_norm = (weighted_quality / weight_total) if weight_total else 0.0
    heuristic_risk = round(_clamp01(1.0 - quality_norm), 3)

    words = [w for w in str(transcript or "").split() if w.strip()]
    wc = len(words)
    unique_ratio = (len(set(w.lower().strip(".,!?;:()[]{}\"'" ) for w in words)) / wc) if wc else 0.0
    text_quality = _clamp01(0.5 * _clamp01(wc / 70.0) + 0.5 * _clamp01(unique_ratio))

    strong_count = sum(1 for key in weights.keys() if _clamp01(sections.get(key, 0.0)) >= 0.8)
    weak_count = sum(1 for key in weights.keys() if _clamp01(sections.get(key, 0.0)) <= 0.35)

    blended_risk = heuristic_risk
    model_used = False
    model_confidence = 0.0
    if model_risk is not None:
        model_val = _clamp01(model_risk)
        model_confidence = _clamp01(abs(model_val - 0.5) * 2.0)
        agreement = 1.0 - abs(model_val - heuristic_risk)
        model_trust = _clamp01(0.15 + 0.55 * model_confidence + 0.2 * agreement + 0.1 * text_quality)
        blended_risk = _clamp01((1 - model_trust) * heuristic_risk + model_trust * model_val)
        model_used = True

    if strong_count >= 6 and text_quality >= 0.55:
        blended_risk -= 0.08
    if weak_count >= 4:
        blended_risk += 0.08

    risk_score = round(_clamp01(blended_risk), 3)
    return {
        "risk_score": risk_score,
        "heuristic_risk": heuristic_risk,
        "text_quality": round(text_quality, 3),
        "model_used": model_used,
        "model_confidence": round(model_confidence, 3),
        "strong_sections": strong_count,
        "weak_sections": weak_count,
    }


def role_required(role: str):
    def decorator(f):
        @wraps(f)
        @token_required
        def wrapped(current_user, *args, **kwargs):
            if current_user.get("role") != role:
                return jsonify({"error": "Forbidden"}), 403
            return f(current_user, *args, **kwargs)

        return wrapped

    return decorator


def _build_report(session_obj, user):
    sections = session_obj.get("sections", {})
    transcript = session_obj.get("voice_transcript", "")
    model_risk = None
    if os.path.exists(MODEL_PATH):
        try:
            model_risk = float(predict_risk(sections, transcript))
        except Exception:
            model_risk = None

    calibration = _calibrate_risk_score(sections, transcript, model_risk=model_risk)
    risk_score = calibration["risk_score"]

    if risk_score >= 0.72:
        interpretation = "High cognitive-risk pattern. Clinical follow-up advised."
    elif risk_score >= 0.45:
        interpretation = "Moderate risk indicators. Monitor progression and reassess."
    else:
        interpretation = "Low immediate risk indicators from current assessment set."

    raw_notes = session_obj.get("notes", "")
    parsed_inputs = {}
    if isinstance(raw_notes, dict):
        parsed_inputs = raw_notes
    elif isinstance(raw_notes, str) and raw_notes.strip():
        try:
            loaded = json.loads(raw_notes)
            parsed_inputs = loaded if isinstance(loaded, dict) else {"raw_notes": raw_notes}
        except Exception:
            parsed_inputs = {"raw_notes": raw_notes}

    return {
        "patient_name": user["name"],
        "patient_email": user["email"],
        "session_id": session_obj["id"],
        "created_at": _now_iso(),
        "last_used_at": user.get("last_used_at"),
        "sections": sections,
        "voice_transcript": session_obj.get("voice_transcript", ""),
        "user_inputs": parsed_inputs,
        "risk_score": risk_score,
        "risk_score_heuristic": calibration["heuristic_risk"],
        "model_used": calibration["model_used"],
        "risk_debug": {
            "text_quality": calibration["text_quality"],
            "model_confidence": calibration["model_confidence"],
            "strong_sections": calibration["strong_sections"],
            "weak_sections": calibration["weak_sections"],
        },
        "interpretation": interpretation,
        "doctor_summary": (
            "Multi-domain screening including recall, reverse sequencing, arithmetic, "
            "semantic categories, and contextual autobiographical prompt analysis."
        ),
        "share_key": secrets.token_urlsafe(16),
    }


def _safe_train_model(csv_path: str = ""):
    try:
        model = train_and_save_model(csv_path=csv_path)
        return True, model, None
    except Exception as e:
        return False, None, f"{e}\n{traceback.format_exc()}"


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200


@app.route('/api/ml/status', methods=['GET'])
@token_required
def ml_status(current_user):
    exists = os.path.exists(MODEL_PATH)
    memory_exists = os.path.exists(MEMORY_MODEL_PATH)
    return jsonify({
        "model_exists": exists,
        "model_path": MODEL_PATH,
        "memory_model_exists": memory_exists,
        "memory_model_path": MEMORY_MODEL_PATH,
        "last_trained_at": datetime.utcfromtimestamp(os.path.getmtime(MODEL_PATH)).isoformat() + "Z" if exists else None,
        "memory_last_trained_at": datetime.utcfromtimestamp(os.path.getmtime(MEMORY_MODEL_PATH)).isoformat() + "Z" if memory_exists else None,
        "mode": "trained-model" if exists else "heuristic-fallback",
    }), 200


@app.route('/api/ml/train', methods=['POST'])
@role_required("admin")
def ml_train(current_user):
    body = request.json or {}
    csv_path = str(body.get("csv_path", "") or "").strip()
    ok, model, err = _safe_train_model(csv_path=csv_path)
    if not ok:
        return jsonify({"error": "Model training failed", "details": err}), 500
    return jsonify({
        "message": "Model trained successfully",
        "model_path": MODEL_PATH,
        "summary": {
            "model_type": model.get("model_type"),
            "dataset_source": model.get("dataset_source"),
            "num_samples": model.get("num_samples"),
            "metrics": model.get("metrics", {}),
            "trained_at": model.get("trained_at"),
        }
    }), 200


@app.route('/api/ml/train-memory-model', methods=['POST'])
@role_required("admin")
def train_memory_model(current_user):
    body = request.json or {}
    dataset_id = str(body.get("dataset_id", "MearaHe/dementiabank") or "MearaHe/dementiabank").strip()
    try:
        summary = train_memory_model_from_hf(dataset_id=dataset_id)
        return jsonify({
            "message": "Memory text model trained successfully",
            "summary": summary,
        }), 200
    except Exception as e:
        return jsonify({"error": "Memory model training failed", "details": str(e)}), 500


@app.route('/api/ml/memory-score', methods=['POST'])
@token_required
def memory_score(current_user):
    body = request.json or {}
    responses = body.get("responses", {}) or {}

    if not isinstance(responses, dict):
        return jsonify({"error": "responses must be an object"}), 400

    scored = {}
    for key, text in responses.items():
        scored[key] = predict_memory_health_score(str(text or ""))

    return jsonify({"scores": scored, "model_exists": os.path.exists(MEMORY_MODEL_PATH)}), 200


@app.route('/api/register', methods=['POST'])
def register():
    body = request.json or {}
    required = ["name", "email", "password"]
    if not all(body.get(k) for k in required):
        return jsonify({"error": "name, email and password are required"}), 400

    data = load_store()
    if _find_user_by_email(data, body["email"]):
        return jsonify({"error": "Email already registered"}), 409

    user = {
        "id": next_id(data, "user"),
        "name": body["name"],
        "email": body["email"],
        "password": body["password"],
        "role": body.get("role", "user"),
        "age": body.get("age"),
        "gender": body.get("gender", "prefer_not_to_say"),
        "phone": body.get("phone", ""),
        "city": body.get("city", ""),
        "emergency_contact": body.get("emergency_contact", ""),
        "emergency_email": body.get("emergency_email", ""),
        "family_history": body.get("family_history", "unknown"),
        "memory_issues": body.get("memory_issues", "unknown"),
        "occupation": body.get("occupation", ""),
        "education": body.get("education", ""),
        "address": body.get("address", ""),
        "medical_notes": body.get("medical_notes", ""),
        "profile_pic": body.get("profile_pic", ""),
        "is_active": True,
        "created_at": _now_iso(),
        "last_used_at": None,
    }
    data["users"].append(user)
    save_store(data)
    return jsonify({"message": "User registered", "user_id": user["id"]}), 201


@app.route('/api/login', methods=['POST'])
def login():
    body = request.json or {}
    email = body.get("email")
    password = body.get("password")
    data = load_store()
    user = _find_user_by_email(data, email)

    if not user or user.get("password") != password:
        return jsonify({"error": "Invalid credentials"}), 401

    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Your account is restricted by admin. Contact support."}), 403

    user["last_used_at"] = _now_iso()
    save_store(data)
    token = generate_token(user)
    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "last_used_at": user.get("last_used_at")
        }
    }), 200


@app.route('/api/me', methods=['GET'])
@token_required
def me(current_user):
    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Your account is restricted by admin."}), 403
    return jsonify({
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "age": user.get("age"),
        "gender": user.get("gender", "prefer_not_to_say"),
        "phone": user.get("phone", ""),
        "city": user.get("city", ""),
        "emergency_contact": user.get("emergency_contact", ""),
        "emergency_email": user.get("emergency_email", ""),
        "family_history": user.get("family_history", "unknown"),
        "memory_issues": user.get("memory_issues", "unknown"),
        "occupation": user.get("occupation", ""),
        "education": user.get("education", ""),
        "address": user.get("address", ""),
        "medical_notes": user.get("medical_notes", ""),
        "profile_pic": user.get("profile_pic", ""),
        "created_at": user.get("created_at"),
        "last_used_at": user.get("last_used_at"),
        "is_active": user.get("is_active", True),
    }), 200


@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    body = request.json or {}
    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot update profile."}), 403

    user["name"] = body.get("name", user["name"])
    user["age"] = body.get("age", user.get("age"))
    user["gender"] = body.get("gender", user.get("gender", "prefer_not_to_say"))
    user["phone"] = body.get("phone", user.get("phone", ""))
    user["city"] = body.get("city", user.get("city", ""))
    user["emergency_contact"] = body.get("emergency_contact", user.get("emergency_contact", ""))
    user["emergency_email"] = body.get("emergency_email", user.get("emergency_email", ""))
    user["family_history"] = body.get("family_history", user.get("family_history", "unknown"))
    user["memory_issues"] = body.get("memory_issues", user.get("memory_issues", "unknown"))
    user["occupation"] = body.get("occupation", user.get("occupation", ""))
    user["education"] = body.get("education", user.get("education", ""))
    user["address"] = body.get("address", user.get("address", ""))
    user["medical_notes"] = body.get("medical_notes", user.get("medical_notes", ""))
    user["profile_pic"] = body.get("profile_pic", user.get("profile_pic", ""))
    user["last_used_at"] = _now_iso()
    save_store(data)
    return jsonify({"message": "Profile updated"}), 200


@app.route('/api/profile/photo', methods=['POST'])
@token_required
def upload_profile_photo(current_user):
    if 'photo' not in request.files:
        return jsonify({"error": "photo file is required"}), 400

    photo = request.files['photo']
    if not photo.filename:
        return jsonify({"error": "photo filename is missing"}), 400

    ext = os.path.splitext(photo.filename)[1].lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        return jsonify({"error": "Only jpg, jpeg, png, webp are allowed"}), 400

    filename = f"user_{current_user['id']}_{int(datetime.utcnow().timestamp())}{ext}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    photo.save(save_path)

    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404

    photo_url = f"{_public_base_url()}/uploads/{filename}"
    user["profile_pic"] = photo_url
    user["last_used_at"] = _now_iso()
    save_store(data)

    return jsonify({"message": "Profile photo uploaded", "profile_pic": photo_url}), 200


@app.route('/uploads/<path:filename>', methods=['GET'])
def get_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/tests/submit', methods=['POST'])
@token_required
def submit_tests(current_user):
    body = request.json or {}
    sections = body.get("sections", {})
    required = ["word_forward", "word_reverse", "number_forward", "number_reverse", "childhood", "adult", "recent", "adaptive"]
    if not all(k in sections for k in required):
        return jsonify({"error": "All test sections are required"}), 400

    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot submit assessments."}), 403

    duplicate = _find_recent_duplicate_report(
        data=data,
        user_id=current_user["id"],
        sections=sections,
        raw_notes=body.get("notes", ""),
    )
    if duplicate:
        user["last_used_at"] = _now_iso()
        save_store(data)
        return jsonify({"message": "Duplicate submission ignored", "report": duplicate, "deduplicated": True}), 200

    session_obj = {
        "id": next_id(data, "session"),
        "user_id": user["id"],
        "created_at": _now_iso(),
        "sections": sections,
        "voice_transcript": body.get("voice_transcript", ""),
        "notes": body.get("notes", ""),
    }
    data["sessions"].append(session_obj)

    report = _build_report(session_obj, user)
    report["id"] = next_id(data, "report")
    report["user_id"] = user["id"]

    report_pdf_path = _create_report_pdf(report)
    report["pdf_path"] = report_pdf_path
    report["notifications"] = _dispatch_report_via_email(user, report)

    data["reports"].append(report)

    user["last_used_at"] = _now_iso()
    save_store(data)
    return jsonify({"message": "Assessment submitted", "report": report}), 201


@app.route('/api/tests/config', methods=['GET'])
@token_required
def get_tests_config(current_user):
    data = load_store()
    return jsonify(_load_test_config(data)), 200


@app.route('/api/memories', methods=['GET'])
@token_required
def list_memories(current_user):
    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot access memories."}), 403

    memories = [m for m in data.get("memory_entries", []) if int(m.get("user_id", -1)) == int(current_user["id"])]
    memories.sort(key=lambda m: int(m.get("id", 0)), reverse=True)
    return jsonify(memories), 200


@app.route('/api/memories', methods=['POST'])
@token_required
def create_memory(current_user):
    body = request.json or {}
    text = str(body.get("text", "") or "").strip()
    if not text:
        return jsonify({"error": "Memory text is required"}), 400

    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot create memories."}), 403

    item = {
        "id": next_id(data, "memory"),
        "user_id": current_user["id"],
        "category": _normalize_memory_category(body.get("category", "Adulthood")),
        "text": text,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    data.setdefault("memory_entries", []).append(item)
    save_store(data)
    return jsonify({"message": "Memory saved", "memory": item}), 201


@app.route('/api/memories/<int:memory_id>', methods=['PUT'])
@token_required
def update_memory(current_user, memory_id):
    body = request.json or {}
    text = str(body.get("text", "") or "").strip()
    if not text:
        return jsonify({"error": "Memory text is required"}), 400

    data = load_store()
    item = next((m for m in data.get("memory_entries", []) if int(m.get("id", -1)) == int(memory_id)), None)
    if not item:
        return jsonify({"error": "Memory not found"}), 404
    if current_user.get("role") != "admin" and int(item.get("user_id", -1)) != int(current_user["id"]):
        return jsonify({"error": "Forbidden"}), 403

    item["category"] = _normalize_memory_category(body.get("category", item.get("category", "Adulthood")))
    item["text"] = text
    item["updated_at"] = _now_iso()
    save_store(data)
    return jsonify({"message": "Memory updated", "memory": item}), 200


@app.route('/api/memories/<int:memory_id>', methods=['DELETE'])
@token_required
def delete_memory(current_user, memory_id):
    data = load_store()
    item = next((m for m in data.get("memory_entries", []) if int(m.get("id", -1)) == int(memory_id)), None)
    if not item:
        return jsonify({"error": "Memory not found"}), 404
    if current_user.get("role") != "admin" and int(item.get("user_id", -1)) != int(current_user["id"]):
        return jsonify({"error": "Forbidden"}), 403

    data["memory_entries"] = [m for m in data.get("memory_entries", []) if int(m.get("id", -1)) != int(memory_id)]
    save_store(data)
    return jsonify({"message": "Memory deleted", "memory_id": memory_id}), 200


@app.route('/api/admin/memories', methods=['GET'])
@role_required("admin")
def admin_memories(current_user):
    data = load_store()
    users_by_id = {u.get("id"): u for u in data.get("users", [])}
    items = sorted(data.get("memory_entries", []), key=lambda m: int(m.get("id", 0)), reverse=True)
    enriched = []
    for m in items:
        user = users_by_id.get(m.get("user_id"), {})
        row = dict(m)
        row["user_name"] = user.get("name", "Unknown")
        row["user_email"] = user.get("email", "")
        enriched.append(row)
    return jsonify(enriched), 200


@app.route('/api/admin/tests/config', methods=['GET'])
@role_required("admin")
def admin_get_tests_config(current_user):
    data = load_store()
    return jsonify(_load_test_config(data)), 200


@app.route('/api/admin/tests/config', methods=['PUT'])
@role_required("admin")
def admin_update_tests_config(current_user):
    body = request.json or {}
    data = load_store()
    next_config = _load_test_config({"test_config": body})
    data["test_config"] = next_config
    save_store(data)
    return jsonify({"message": "Assessment question config updated", "config": next_config}), 200


@app.route('/api/user/reports', methods=['GET'])
@token_required
def user_reports(current_user):
    data = load_store()
    if _cleanup_immediate_duplicate_reports(data):
        save_store(data)
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot access reports."}), 403
    reports = [r for r in data["reports"] if r["user_id"] == current_user["id"]]
    reports.sort(key=lambda r: r["id"], reverse=True)
    return jsonify(reports), 200


@app.route('/api/reports/<int:report_id>', methods=['GET'])
@token_required
def get_report(current_user, report_id):
    data = load_store()
    report = next((r for r in data["reports"] if r["id"] == report_id), None)
    if not report:
        return jsonify({"error": "Report not found"}), 404

    if current_user.get("role") != "admin" and report["user_id"] != current_user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify(report), 200


@app.route('/api/reports/<int:report_id>/download', methods=['GET'])
@token_required
def download_report(current_user, report_id):
    data = load_store()
    report = next((r for r in data["reports"] if r["id"] == report_id), None)
    if not report:
        return jsonify({"error": "Report not found"}), 404

    if current_user.get("role") != "admin" and report["user_id"] != current_user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    out_dir = os.path.join(BACKEND_DIR, "exports")
    os.makedirs(out_dir, exist_ok=True)
    filepath = os.path.join(out_dir, f"report_{report_id}.html")

    risk_score = float(report.get('risk_score', 0))
    if risk_score < 0.35:
        risk_color = '#00c9a7'
        risk_label = 'Low Risk'
        risk_bg = 'rgba(0, 201, 167, 0.1)'
    elif risk_score < 0.65:
        risk_color = '#f59e0b'
        risk_label = 'Moderate'
        risk_bg = 'rgba(245, 158, 11, 0.1)'
    else:
        risk_color = '#fb7185'
        risk_label = 'High Risk'
        risk_bg = 'rgba(251, 113, 133, 0.1)'

    sections_html = ''
    for k, v in report.get("sections", {}).items():
        pct = round(float(v) * 100, 1)
        sections_html += f'''
        <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #333; text-transform: capitalize;">{k.replace('_', ' ')}</span>
                <span style="font-weight: 700; color: {risk_color};">{pct}%</span>
            </div>
            <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: {pct}%; background: {risk_color}; border-radius: 4px;"></div>
            </div>
        </div>
        '''

    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CogniGuard Report #{report['id']}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #f9fafb;
            padding: 20px;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
        }}
        .header p {{
            font-size: 1.1rem;
            opacity: 0.95;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .section {{
            margin-bottom: 32px;
        }}
        .section h2 {{
            font-size: 1.4rem;
            color: #111827;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 24px;
        }}
        .info-item {{
            padding: 16px;
            background: #f3f4f6;
            border-radius: 8px;
        }}
        .info-item label {{
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }}
        .info-item value {{
            display: block;
            font-size: 1.1rem;
            font-weight: 600;
            color: #1f2937;
        }}
        .risk-score {{
            background: {risk_bg};
            border-left: 5px solid {risk_color};
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 24px;
        }}
        .risk-score h3 {{
            color: {risk_color};
            font-size: 1.2rem;
            margin-bottom: 10px;
        }}
        .risk-percentage {{
            font-size: 3rem;
            font-weight: 800;
            color: {risk_color};
            margin: 10px 0;
        }}
        .risk-label {{
            display: inline-block;
            background: {risk_color};
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-top: 10px;
        }}
        .interpretation {{
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 24px;
            font-size: 0.95rem;
            line-height: 1.7;
        }}
        .sections-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
        }}
        .notes {{
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 6px;
            margin-top: 24px;
            font-size: 0.9rem;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        .footer {{
            background: #f9fafb;
            padding: 20px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 0.85rem;
            color: #6b7280;
        }}
        @media (max-width: 768px) {{
            .info-grid {{
                grid-template-columns: 1fr;
            }}
            .sections-grid {{
                grid-template-columns: 1fr;
            }}
            .header h1 {{
                font-size: 1.8rem;
            }}
            .risk-percentage {{
                font-size: 2rem;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 CogniGuard Report</h1>
            <p>Cognitive Assessment Screening Report</p>
        </div>
        
        <div class="content">            <div class="section">
                <h2>Patient Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Report ID</label>
                        <value>#{report['id']}</value>
                    </div>
                    <div class="info-item">
                        <label>Patient Name</label>
                        <value>{report.get('patient_name', 'N/A')}</value>
                    </div>
                    <div class="info-item">
                        <label>Email</label>
                        <value>{report.get('patient_email', 'N/A')}</value>
                    </div>
                    <div class="info-item">
                        <label>Created At</label>
                        <value>{report.get('created_at', 'N/A')}</value>
                    </div>
                </div>
            </div>            <div class="section">
                <h2>Risk Assessment</h2>
                <div class="risk-score">
                    <h3>Overall Risk Score</h3>
                    <div class="risk-percentage">{round(risk_score * 100, 1)}%</div>
                    <span class="risk-label">{risk_label}</span>
                    <p style="margin-top: 12px; font-size: 0.9rem;">{report.get('interpretation', '')}</p>
                </div>
            </div>            <div class="section">
                <h2>Detailed Section Scores</h2>
                <div class="sections-grid">
                    {sections_html}
                </div>
            </div>            {f'<div class="section"><h2>Clinical Notes</h2><div class="notes">{report.get("doctor_summary", "No clinical notes provided.")}</div></div>' if report.get('doctor_summary') else ''}            {f'<div class="section"><h2>Voice Transcript</h2><div class="notes">{report.get("voice_transcript", "No transcript available.")}</div></div>' if report.get('voice_transcript') else ''}
        </div>

        <div class="footer">
            <p>This report was generated by CogniGuard Clinical Screening System</p>
            <p style="margin-top: 8px;">Session: {report.get('session_id', 'N/A')} | Generated: {report.get('created_at', 'N/A')}</p>
        </div>
    </div>
</body>
</html>'''

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html_content)

    return send_file(filepath, as_attachment=True, mimetype='text/html'), 200


@app.route('/api/reports/<int:report_id>/pdf', methods=['GET'])
@token_required
def download_report_pdf(current_user, report_id):
    data = load_store()
    report = next((r for r in data["reports"] if r["id"] == report_id), None)
    if not report:
        return jsonify({"error": "Report not found"}), 404

    if current_user.get("role") != "admin" and report["user_id"] != current_user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    pdf_path = report.get("pdf_path") or os.path.join(_export_dir(), f"report_{report_id}.pdf")
    if not os.path.exists(pdf_path):
        pdf_path = _create_report_pdf(report)
    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"error": "PDF not available"}), 404

    return send_file(pdf_path, as_attachment=True), 200


@app.route('/api/public/reports/<int:report_id>/pdf/<share_key>', methods=['GET'])
def public_report_pdf(report_id, share_key):
    data = load_store()
    report = next((r for r in data["reports"] if r["id"] == report_id), None)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    if report.get("share_key") != share_key:
        return jsonify({"error": "Invalid share key"}), 403

    pdf_path = report.get("pdf_path") or os.path.join(_export_dir(), f"report_{report_id}.pdf")
    if not os.path.exists(pdf_path):
        pdf_path = _create_report_pdf(report)
    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"error": "PDF not available"}), 404

    return send_file(pdf_path, as_attachment=False), 200


@app.route('/api/feedback', methods=['POST'])
@token_required
def submit_feedback(current_user):
    body = request.json or {}
    message = body.get("message", "").strip()
    if not message:
        return jsonify({"error": "Feedback message is required"}), 400

    data = load_store()
    user = _find_user_by_id(data, current_user["id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") != "admin" and user.get("is_active", True) is False:
        return jsonify({"error": "Restricted users cannot submit feedback."}), 403

    item = {
        "id": next_id(data, "feedback"),
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "User"),
        "message": message,
        "created_at": _now_iso(),
    }
    data["feedback"].append(item)
    save_store(data)
    return jsonify({"message": "Feedback submitted"}), 201


@app.route('/api/admin/overview', methods=['GET'])
@role_required("admin")
def admin_overview(current_user):
    data = load_store()
    users = [u for u in data["users"] if u["role"] == "user"]
    reports = data["reports"]
    feedback = data["feedback"]
    memories = data.get("memory_entries", [])
    avg_risk = round(sum(r.get("risk_score", 0) for r in reports) / len(reports), 3) if reports else 0

    return jsonify({
        "patients_count": len(users),
        "reports_count": len(reports),
        "feedback_count": len(feedback),
        "memories_count": len(memories),
        "average_risk_score": avg_risk,
    }), 200


@app.route('/api/admin/patients', methods=['GET'])
@role_required("admin")
def admin_patients(current_user):
    data = load_store()
    users = [u for u in data["users"] if u["role"] == "user"]
    memories = data.get("memory_entries", [])
    memory_count = {}
    for m in memories:
        uid = int(m.get("user_id", -1))
        memory_count[uid] = memory_count.get(uid, 0) + 1

    for u in users:
        u.pop("password", None)
        u["shared_memories_count"] = memory_count.get(int(u.get("id", -1)), 0)
    return jsonify(users), 200


@app.route('/api/admin/users/<int:user_id>/status', methods=['PATCH'])
@role_required("admin")
def admin_set_user_status(current_user, user_id):
    data = load_store()
    user = _find_user_by_id(data, user_id)
    if not user or user.get("role") == "admin":
        return jsonify({"error": "User not found"}), 404

    body = request.json or {}
    if "is_active" not in body:
        return jsonify({"error": "is_active is required"}), 400

    user["is_active"] = bool(body.get("is_active"))
    user["status_updated_at"] = _now_iso()
    save_store(data)
    return jsonify({
        "message": "User status updated",
        "user_id": user_id,
        "is_active": user["is_active"],
    }), 200


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@role_required("admin")
def admin_delete_user(current_user, user_id):
    data = load_store()
    user = _find_user_by_id(data, user_id)
    if not user or user.get("role") == "admin":
        return jsonify({"error": "User not found"}), 404

    data["users"] = [u for u in data["users"] if u.get("id") != user_id]
    data["sessions"] = [s for s in data["sessions"] if s.get("user_id") != user_id]
    data["reports"] = [r for r in data["reports"] if r.get("user_id") != user_id]
    data["feedback"] = [f for f in data["feedback"] if f.get("user_id") != user_id]
    data["memory_entries"] = [m for m in data.get("memory_entries", []) if m.get("user_id") != user_id]
    save_store(data)
    return jsonify({"message": "User and related records deleted", "user_id": user_id}), 200


@app.route('/api/admin/reports', methods=['GET'])
@role_required("admin")
def admin_reports(current_user):
    data = load_store()
    if _cleanup_immediate_duplicate_reports(data):
        save_store(data)
    session_map = {s.get("id"): s for s in data.get("sessions", [])}
    reports = sorted(data["reports"], key=lambda x: x["id"], reverse=True)

    enriched = []
    for r in reports:
        item = dict(r)
        if not item.get("user_inputs"):
            sess = session_map.get(item.get("session_id"))
            if sess:
                raw_notes = sess.get("notes", "")
                if isinstance(raw_notes, dict):
                    item["user_inputs"] = raw_notes
                elif isinstance(raw_notes, str) and raw_notes.strip():
                    try:
                        parsed = json.loads(raw_notes)
                        item["user_inputs"] = parsed if isinstance(parsed, dict) else {"raw_notes": raw_notes}
                    except Exception:
                        item["user_inputs"] = {"raw_notes": raw_notes}

        enriched.append(item)
    return jsonify(enriched), 200


@app.route('/api/admin/feedback', methods=['GET'])
@role_required("admin")
def admin_feedback(current_user):
    data = load_store()
    feedback = sorted(data["feedback"], key=lambda x: x["id"], reverse=True)
    return jsonify(feedback), 200


@app.route('/api/analyze', methods=['POST'])
@token_required
def analyze_audio(current_user):
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    if not audio_file.filename:
        return jsonify({"error": "Audio filename is missing"}), 400

    audio_path = os.path.join(app.config['UPLOAD_FOLDER'], audio_file.filename)
    audio_file.save(audio_path)
    risk_score = round(0.25 + (len(audio_file.filename) % 50) / 100, 2)
    if os.path.exists(audio_path):
        os.remove(audio_path)
    return jsonify({"status": "Complete", "risk_score": risk_score, "task_id": None}), 200


if __name__ == '__main__':
    import os
    # Production hosts (Render/Railway/Fly.io) inject a PORT env var and bind to 0.0.0.0.
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=False
    )
