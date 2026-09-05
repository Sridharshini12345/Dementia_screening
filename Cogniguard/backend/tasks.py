from celery import Celery
from config import Config
import time
import os

celery = Celery(__name__, broker=Config.CELERY_BROKER_URL, backend=Config.CELERY_RESULT_BACKEND)

@celery.task(bind=True)
def process_audio_task(self, audio_path, user_id):
    """
    Background task to process audio, transcribe, analyze via Gemini, and predict score.
    """
    time.sleep(2)
    transcript = "Mock transcribed text simulating early signs of hesitations and vocabulary simplification."

    time.sleep(1)
    linguistic_features = {"vocabulary_richness": 0.8, "hesitations": 0.15}

    time.sleep(1)
    risk_score = 0.35

    if os.path.exists(audio_path):
        os.remove(audio_path)

    return {"status": "Complete", "risk_score": risk_score, "transcript": transcript}
