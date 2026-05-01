"""
Centralized logging configuration using loguru.
Logs are written to both console and a rotating file.
"""
import sys
import os
from loguru import logger


def setup_logger():
    """Configure loguru logger with console and file handlers."""
    os.makedirs("logs", exist_ok=True)

    # Remove default handler
    logger.remove()

    # Console handler with color
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO",
        colorize=True,
    )

    # Rotating file handler
    logger.add(
        "logs/rag_app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
    )

    return logger


# Initialize logger on import
setup_logger()

__all__ = ["logger"]
