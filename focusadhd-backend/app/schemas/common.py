from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any, Optional, Dict

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[str] = None
    timestamp: datetime

class ErrorResponse(BaseModel):
    error: ErrorDetail

class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str

class PaginatedResponse(BaseModel):
    data: list[Any]
    total: int
    page: int
    size: int
    
    model_config = ConfigDict(from_attributes=True)
