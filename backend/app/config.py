from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./cheatsheetmaker.db"
    SECRET_KEY: str = "dev-fallback-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5MB

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = (".env", "../.env")  # look in backend/ first, then project root (in this case i have it on global env)
        extra = "ignore"


settings = Settings()
