# System Architecture

CogniGuard-v2 utilizes a highly scalable, decoupled full-stack architecture optimized for heavy AI processing and secure handling of PHI.

## 1. High-Level Diagram

```text
+-------------------+       +-----------------------+       +-------------------+
|                   |       |                       |       |                   |
|   Next.js App     | <---> |   Flask Backend API   | <---> |   PostgreSQL DB   |
| (UI, Audio Rec,   |       | (Auth, Route, Models) |       | (User Data, Risk) |
|  Memory Tree)     |       |                       |       |                   |
+-------------------+       +-----------------------+       +-------------------+
                                       |
                                       v
                            +-----------------------+
                            |     Redis Broker      |
                            +-----------------------+
                                       |
                                       v
                            +-----------------------+
                            |    Celery Workers     |
                            | (Whisper, Gemini, ML) |
                            +-----------------------+
```

## 2. Component Details

### 2.1 Frontend (Next.js)
- **Welcome Page**: Engaging landing interface introducing the system.
- **Auth Flow**: `/login` and `/register`. Registration builds the user profile via a localized cognitive questionnaire.
- **Audio Capture**: Implements `MediaRecorder` API to capture speech within the browser.
- **Memory Tree Dashboard**: A reactive visualization element (using libraries like Recharts or D3.js) structurally displaying cognitive health over multiple interactions.

### 2.2 Backend API (Flask)
- **Authentication**: JWT verification on all protected endpoints.
- **Encryption Engine**: All patient records (like survey answers) are encrypted with an AES-256 cipher before persistent storage.
- **Task Dispatch**: Synchronous endpoints offload heavy payload processing (like audio transcription) to asynchronous Celery workers to prevent HTTP timeout.

### 2.3 Task Queue (Celery & Redis)
- **Redis**: In-memory data structure store used as a message broker between Flask and Celery.
- **Workers**: Listen for tasks containing audio bytes or transcripts. Handle GPU/CPU intensive work with `Faster-Whisper` and API calls to `Gemini`.

### 2.4 ML Components
- **Faster-Whisper**: Deployed within workers, significantly outperforming standard Whisper in speed while maintaining accuracy for transcription.
- **Gemini (Google)**: Used to parse nuanced linguistic signals from the transcript (e.g., semantic drift, word-finding difficulty).
- **XGBoost & Random Forest**: Tabular models fed with Gemini's outputs, along with user profile metadata, to output a continuous 'Risk Score' spanning 0.0 - 1.0.

## 3. Data Flow

1. User answers questionnaire & provides voice sample.
2. Next.js formats form data + `Blob` -> `POST /api/analyze`.
3. Flask verifies JWT, encrypts personal specifics, replies `202 Accepted` with a `task_id`.
4. Celery worker receives `task_id`.
5. Worker runs Whisper -> sends text to Gemini -> feeds vectors to XGBoost model.
6. Worker saves Risk Score against User ID in DB.
7. Next.js frontend polls `GET /api/status/<task_id>` or receives SSE.
8. Dashboard navigates to result, populating the 'Memory Tree'.
