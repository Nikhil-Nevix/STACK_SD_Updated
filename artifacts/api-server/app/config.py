import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/stack")

    # Auth
    session_secret: str = os.getenv("SESSION_SECRET", "change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Azure OpenAI (optional — AI features activate when set)
    azure_openai_api_key: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    azure_openai_endpoint: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_openai_deployment: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    azure_openai_embedding_deployment: str = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
    azure_openai_api_version: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    # Freshservice (optional)
    freshservice_domain: str = os.getenv("FRESHSERVICE_DOMAIN", "")
    freshservice_api_key: str = os.getenv("FRESHSERVICE_API_KEY", "")

    # Microsoft Graph API (optional)
    ms_tenant_id: str = os.getenv("MS_TENANT_ID", "")
    ms_client_id: str = os.getenv("MS_CLIENT_ID", "")
    ms_client_secret: str = os.getenv("MS_CLIENT_SECRET", "")

    # Redis / Celery (optional)
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    # Google Chat Bot (optional)
    google_chat_service_account_json: str = os.getenv("GOOGLE_CHAT_SERVICE_ACCOUNT_JSON", "")

    # PowerShell / WinRM (optional)
    winrm_username: str = os.getenv("WINRM_USERNAME", "")
    winrm_password: str = os.getenv("WINRM_PASSWORD", "")
    winrm_transport: str = os.getenv("WINRM_TRANSPORT", "ntlm")

    # License APIs (optional)
    adobe_client_id: str = os.getenv("ADOBE_CLIENT_ID", "")
    adobe_client_secret: str = os.getenv("ADOBE_CLIENT_SECRET", "")
    bluebeam_api_key: str = os.getenv("BLUEBEAM_API_KEY", "")

    @property
    def ai_enabled(self) -> bool:
        return bool(self.azure_openai_api_key and self.azure_openai_endpoint)

    @property
    def freshservice_enabled(self) -> bool:
        return bool(self.freshservice_domain and self.freshservice_api_key)

    @property
    def graph_api_enabled(self) -> bool:
        return bool(self.ms_tenant_id and self.ms_client_id and self.ms_client_secret)

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
