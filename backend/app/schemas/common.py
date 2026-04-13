from pydantic import BaseModel


class TaskResponse(BaseModel):
    task_id: str
    status: str = "queued"
    message: str = ""


class ErrorResponse(BaseModel):
    detail: str


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = ""
