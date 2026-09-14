from pydantic_settings import BaseSettings
from typing import Optional, List
import os


class Settings(BaseSettings):
    # Application
    app_name: str = "ChainMind AI"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = True

    # Database
    database_url: str = "sqlite:///./chainmind.db"

    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # LLM Configuration
    llm_provider: str = "none"  # "openai", "watsonx", "none"
    llm_api_key: Optional[str] = None
    llm_model: str = "gpt-4o-mini"

    # IBM watsonx.ai (optional)
    watsonx_api_key: Optional[str] = None
    watsonx_project_id: Optional[str] = None
    watsonx_url: str = "https://us-south.ml.cloud.ibm.com"

    # ML Models
    ml_models_dir: str = "ml_models"

    # Simulation defaults
    default_delay_multiplier_low: float = 1.2
    default_delay_multiplier_medium: float = 1.5
    default_delay_multiplier_high: float = 2.0

    # Risk score weights
    weight_delay: float = 0.25
    weight_cargo_value: float = 0.20
    weight_cold_chain: float = 0.20
    weight_route_risk: float = 0.15
    weight_priority: float = 0.15
    weight_fleet_avail: float = 0.05

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
