import os
import importlib

def _safe_load_dotenv(dotenv_path: str) -> bool:
    """Load .env if python-dotenv is installed; otherwise no-op."""
    try:
        dotenv_module = importlib.import_module('dotenv')
        return bool(dotenv_module.load_dotenv(dotenv_path))
    except Exception:
        return False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
_safe_load_dotenv(os.path.join(BASE_DIR, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-cogniguard-key'
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or 'redis://localhost:6379/0'
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or 'redis://localhost:6379/0'
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or os.path.join(ROOT_DIR, 'uploads')
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL')
    SMTP_HOST = os.environ.get('SMTP_HOST')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
    SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
    SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL')
    SMTP_USE_TLS = os.environ.get('SMTP_USE_TLS', 'true').lower() in ('1', 'true', 'yes')
