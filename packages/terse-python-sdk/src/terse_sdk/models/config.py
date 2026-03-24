"""Typed settings loaded from `TERSE_*` environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class TerseSettings(BaseSettings):
    api_key: str = ""
    frontend_url: str = "https://app.useterse.ai"
    backend_url: str = "https://cursor-for-tickets.onrender.com"

    model_config = SettingsConfigDict(env_prefix="TERSE_", extra="ignore")
