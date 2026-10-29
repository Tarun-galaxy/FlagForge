from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    JWT_SECRET: str = "flagforge_super_secret_jwt_key_2026_x9k2"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/callback/google"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5173/auth/callback/github"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

