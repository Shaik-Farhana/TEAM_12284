from fastapi import Request, status
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class AppError(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR, details: str = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return build_error_response(
        "An unexpected error occurred", 
        "INTERNAL_ERROR", 
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        str(exc)
    )

async def app_error_handler(request: Request, exc: AppError):
    logger.warning(f"AppError [{exc.code}]: {exc.message}")
    return build_error_response(exc.message, exc.code, exc.status_code, exc.details)

def build_error_response(message: str, code: str, status_code: int, details: str = None):
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": message,
                "code": code,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    )
