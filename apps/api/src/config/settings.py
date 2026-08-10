from pathlib import Path
from pydantic_settings import BaseSettings

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "SupportAI API"
    DATABASE_URL: str = "sqlite+aiosqlite:///./supportai.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672//"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    
    JWT_SECRET_KEY: str = "super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    GOOGLE_CLIENT_ID: str = "mock-google-client-id"
    GOOGLE_CLIENT_SECRET: str = "mock-google-client-secret"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    STRIPE_SECRET_KEY: str = "sk_test_mock_stripe_secret_key"
    STRIPE_WEBHOOK_SECRET: str = "whsec_mock_stripe_webhook_secret"

    STRIPE_PRICE_ID_STARTER_MONTHLY: str = "price_starter_monthly"
    STRIPE_PRICE_ID_STARTER_ANNUAL: str = "price_starter_annual"
    STRIPE_PRICE_ID_PRO_MONTHLY: str = "price_pro_monthly"
    STRIPE_PRICE_ID_PRO_ANNUAL: str = "price_pro_annual"
    STRIPE_PRICE_ID_BUSINESS_MONTHLY: str = "price_business_monthly"
    STRIPE_PRICE_ID_BUSINESS_ANNUAL: str = "price_business_annual"

    CLOUDINARY_CLOUD_NAME: str = "mock_cloud"
    CLOUDINARY_API_KEY: str = "mock_api_key"
    CLOUDINARY_API_SECRET: str = "mock_api_secret"

    class Config:
        env_file = [str(_env_path), ".env"]
        extra = "ignore"

settings = Settings()

