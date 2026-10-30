"""All settings come from environment variables (or a .env file)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
TTS_DIR = DATA_DIR / "tts_cache"
TTS_DIR.mkdir(exist_ok=True)
STATIC_DIR = BASE_DIR / "static"


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _str(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


class Settings:
    def __init__(self) -> None:
        # Sarvam (speech in/out, transliteration)
        self.sarvam_api_key = _str("SARVAM_API_KEY")
        self.sarvam_base_url = _str("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
        self.stt_model = _str("STT_MODEL", "saaras:v4")
        self.stt_mode = _str("STT_MODE", "codemix")
        self.stt_language_code = _str("STT_LANGUAGE_CODE")
        self.stt_use_ui_language = _bool("STT_USE_UI_LANGUAGE", False)
        self.tts_enabled = _bool("TTS_ENABLED", True)
        self.tts_model = _str("TTS_MODEL", "bulbul:v3")
        self.tts_speaker = _str("TTS_SPEAKER", "shubh")

        # LLM (OpenAI-compatible). Defaults to Sarvam's chat API.
        self.llm_base_url = _str("LLM_BASE_URL", "https://api.sarvam.ai/v1").rstrip("/")
        self.llm_api_key = _str("LLM_API_KEY") or self.sarvam_api_key
        self.llm_model = _str("LLM_MODEL", "sarvam-105b")
        self.query_llm_model = _str("QUERY_LLM_MODEL") or self.llm_model
        self.llm_reasoning_effort = _str("LLM_REASONING_EFFORT")

        # App
        self.database_url = _str("DATABASE_URL", f"sqlite:///{DATA_DIR / 'khata.db'}")
        self.public_base_url = _str("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
        self.shop_name = _str("SHOP_NAME", "Shanthi Stores")
        self.merchant_language = _str("MERCHANT_LANGUAGE", "ta-IN")
        self.http_timeout = float(_str("HTTP_TIMEOUT", "20"))

        # Messaging: "simulator" (default) or "whatsapp"
        self.messaging_channel = _str("MESSAGING_CHANNEL", "simulator")
        self.whatsapp_token = _str("WHATSAPP_TOKEN")
        self.whatsapp_phone_number_id = _str("WHATSAPP_PHONE_NUMBER_ID")
        self.whatsapp_verify_token = _str("WHATSAPP_VERIFY_TOKEN", "khata-saathi-verify")
        self.whatsapp_app_secret = _str("WHATSAPP_APP_SECRET")
        self.whatsapp_api_version = _str("WHATSAPP_API_VERSION", "v21.0")

        # Payments: "mock" (default) or "paytm"
        self.payment_provider = _str("PAYMENT_PROVIDER", "mock")
        self.payment_webhook_secret = _str("PAYMENT_WEBHOOK_SECRET", "change-this-secret")

        # Rules and guardrails
        self.max_amount_rupees = int(_str("MAX_AMOUNT_RUPEES", "50000"))
        self.default_due_days = float(_str("DEFAULT_DUE_DAYS", "3"))
        self.reminder_gap_days = float(_str("REMINDER_GAP_DAYS", "2"))
        self.min_hours_between_reminders = float(_str("MIN_HOURS_BETWEEN_REMINDERS", "24"))
        # "9-20" = send only 9:00-19:59 IST. Set it empty to allow any time.
        self.quiet_hours = os.getenv("QUIET_HOURS", "9-20").strip()
        self.pending_minutes = int(_str("PENDING_MINUTES", "10"))

        # Runtime
        self.scheduler_enabled = _bool("SCHEDULER_ENABLED", True)
        self.demo_mode = _bool("DEMO_MODE", True)

    @property
    def voice_enabled(self) -> bool:
        return bool(self.sarvam_api_key)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


settings = Settings()
