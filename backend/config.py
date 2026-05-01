"""
Configuration management using pydantic-settings.
All secrets are loaded from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Groq API
    groq_api_key: str = Field(..., env="GROQ_API_KEY")
    groq_chat_model: str = Field("llama-3.1-8b-instant")

    # Local Embeddings (HuggingFace)
    # Model name is hardcoded in rag_pipeline.py, so we don't need it in env

    # RAG Pipeline
    chunk_size: int = Field(500, env="CHUNK_SIZE")
    chunk_overlap: int = Field(50, env="CHUNK_OVERLAP")
    top_k_sources: int = Field(1)

    # Storage
    upload_dir: str = Field("uploads", env="UPLOAD_DIR")
    vector_store_dir: str = Field("vectorstore", env="VECTOR_STORE_DIR")

    # Server
    cors_origins: list[str] = Field(["http://localhost:3000", "http://localhost:5173"], env="CORS_ORIGINS")
    max_upload_size_mb: int = Field(50, env="MAX_UPLOAD_SIZE_MB")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
