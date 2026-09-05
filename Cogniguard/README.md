# CogniGuard-v2 🧠 🛡️

CogniGuard-v2 is an AI-assisted full-stack dementia/cognitive screening platform. It combines timed cognitive game rounds, voice/text signals, and a trainable backend risk model to estimate cognitive risk and provide actionable report insights.

## 🌟 Key Features

- **Intuitive Workflow & Registration**: A seamless user journey starting from a welcoming landing page, secure login, and a comprehensive registration process that gathers basic personal details alongside a cognitive-related questionnaire to build a solid user profile.
- **Voice + Text Cognitive Signals**: Captures recall/reverse recall quality, timing, and speech-style richness.
- **Trainable Risk Model Pipeline**: Includes a backend training pipeline (public-dataset compatible CSV format + synthetic fallback) and model artifact persistence.
- **Admin ML Controls**: Train/retrain model from admin panel and monitor model status.
- **Interactive Visualization**: The **'Memory Tree'** dashboard visually represents the user's cognitive health over time, effectively translating complex clinical data into accessible visual insights.
- **Paramount Security & Scalability**: Secures all Patient Health Information (PHI) with **AES-256 encryption** and employs **JWT-based authentication**. The system features a decoupled backend and frontend for maximum scalability.
- **Background Processing**: Employs **Celery and Redis** for real-time background task processing (transcription, AI analysis), ensuring unmatched user experience.

## 🚀 Complete Workflow

1. **Data Capture**: The frontend web application securely captures audio input from the user.
2. **Scoring**: Multi-level round scores (repeat, reverse, math, orientation, etc.) are computed in frontend and sent to backend.
3. **Prediction**: Backend predicts risk using:
   - trained model (if available), or
   - heuristic fallback (if no model exists yet).
4. **Reporting**: Results and section diagnostics are stored and shown in dashboard/reports/admin analytics.

## 🛠 Technology Stack

### Frontend (User Interface)
- **Next.js** (React Framework)
- Vanilla CSS Context / Modern Dynamic UI Design
- Context API (State Management)
- Axios (API Communication)

### Backend (API & Processing)
- **Python Flask** (Micro-framework)
- **Celery & Redis** (optional async hooks)
- **JWT** (JSON Web Tokens Authentication)
- **AES-256** Encryption (PyCryptodome for sensitive data)
- **Custom Logistic Regression Pipeline** (pure Python fallback-safe training)

## 📦 Project Structure

```
CogniGuard-v2/
  backend/
    app.py
    ml_pipeline.py
    train_model.py
    store.py
    requirements.txt
    Dockerfile
  frontend/
    src/app/... (Next.js routes)
    Dockerfile
  docker-compose.yml
```

## ▶️ Run Locally

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- -p 3000
```

Open: `http://localhost:3000/login`

## Environment Variables (Local + Deployment)

Do not put personal credentials inside source files like `backend/config.py`.
Use environment variables instead.

### Local setup
1. Copy `backend/.env.example` to `backend/.env`.
2. Fill real values in `backend/.env`.
3. Run backend normally (`python app.py`).

`backend/.env` is ignored by git (safe by default).

### Required for email report delivery
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_USE_TLS`
- `PUBLIC_BASE_URL`

### Deployment setup (GitHub + cloud)
Keep placeholders in git and add real secrets in your hosting platform dashboard:

- **Render / Railway / Fly.io**:
  Add these keys under service environment variables/secrets.
- **Docker Compose / VM**:
  Use `env_file` or host-level environment variables.
- **GitHub Actions**:
  Store sensitive values in repository secrets and inject at deploy time.

Never commit real SMTP usernames/passwords or app passwords into repository files.

## 🧪 Train Model

### Option A: Train from synthetic fallback (instant)
```bash
cd backend
python train_model.py
```

### Option B: Train from CSV dataset
```bash
cd backend
python train_model.py --csv "C:\\path\\to\\dataset.csv"
```

CSV columns expected:
- `voice, word_recall, reverse_recall, math, general, pattern, orientation, life_context`
- optional: `transcript`
- label: `label` (0/1)

Model artifact saved at:
- `backend/data/models/cognitive_risk_model.json`

### Memory text model
```bash
cd backend
python train_memory_model.py
```

Memory model artifact saved at:
- `backend/data/models/memory_text_model.joblib`

That `.joblib` file is a binary Python model artifact, so it will not open as readable text in VS Code or in the browser. Use Python to inspect it or load it from the app instead of trying to open it as a document.

Example inspection snippet:
```bash
python - <<'PY'
from joblib import load
payload = load('backend/data/models/memory_text_model.joblib')
print(payload['model_type'])
print(payload['metrics'])
PY
```

## 📒 Colab Training (recommended exact flow)

In a fresh Colab notebook:

```python
!git clone https://github.com/<your-user>/<your-repo>.git
%cd /content/<your-repo>/backend
!pip install -r requirements.txt
```

Train the risk model:

```python
!python train_model.py
```

Train the memory model:

```python
!python train_memory_model.py
```

Verify the artifacts:

```python
!ls -lh data/models
```

If you want to push the generated model files back to Git, do this from the repo root on a machine that has your Git credentials configured:

```bash
git status
git add backend/data/models/cognitive_risk_model.json backend/data/models/memory_text_model.joblib
git commit -m "Update trained model artifacts"
git push
```

Do not add `backend/.env`, `backend/.env.example`, or any secret-bearing file to the commit. Keep environment variables local or in deployment secrets only.

## 🎓 Viva / Demo

If you need to show the memory model in front of the viva panel, the easiest options are:

1. Open the app and show the assessment flow plus the results/report page.
2. Show the generated report PDF or HTML export.
3. Use the Python inspection snippet above to prove the `.joblib` artifact exists and loads correctly.

You do not need a VS Code extension to open `.joblib`; it is not meant to be edited like source code.

## 🧑‍⚕️ Admin ML APIs

- `GET /api/ml/status` (token required)
- `POST /api/ml/train` (admin only)
  - body: `{ "csv_path": "optional\\path\\to\\dataset.csv" }`

## 🐳 Docker Deployment

From project root:
```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## 🔐 Demo Admin Credentials

- Email: `admin@cogniguard.local`
- Password: `admin123`

## 🚀 5–7 Day Production Path (Recommended)

1. Replace synthetic fallback with curated public dataset CSV pipeline.
2. Add stronger feature extraction (pauses, lexical richness, temporal markers).
3. Add stratified validation + calibration + threshold tuning.
4. Add background training jobs (Celery) and model versioning.
5. Add production monitoring, alerts, and secure secret management.
6. Deploy backend+frontend on cloud (Render/Railway/AWS/GCP).
