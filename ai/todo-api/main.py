"""
Task API — a small in-memory CRUD API built with FastAPI.

FlyRank Internship · Backend Track · Week 2 · Assignment A1

Run with:
    uvicorn main:app --reload --port 8000

Then visit:
    http://localhost:8000        -> API info
    http://localhost:8000/health -> health check
    http://localhost:8000/docs   -> Swagger UI (interactive docs)
"""

from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

app = FastAPI(
    title="Task API",
    version="1.0",
    description="A tiny in-memory to-do list API. Data resets every time the server restarts.",
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Normalize every error response to { "error": "..." } as required by the spec.
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # A malformed/missing body (e.g. no "title") is a client mistake -> 400, not 422.
    first = exc.errors()[0]
    field = ".".join(str(p) for p in first["loc"] if p != "body")
    return JSONResponse(status_code=400, content={"error": f"invalid request body: {field} - {first['msg']}"})

# ---------------------------------------------------------------------------
# "Database" — just a Python list living in memory. Restarting the server
# wipes it clean. That's expected: persistence is next week's lesson.
# ---------------------------------------------------------------------------

DEFAULT_TASKS = [
    {"id": 1, "title": "Buy milk", "done": False},
    {"id": 2, "title": "Read FastAPI docs", "done": True},
    {"id": 3, "title": "Push code to GitHub", "done": False},
]

tasks: list[dict] = [t.copy() for t in DEFAULT_TASKS]
next_id: int = 4


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, description="What needs to be done")


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, description="New title")
    done: Optional[bool] = Field(None, description="Mark task done/undone")


class Task(BaseModel):
    id: int
    title: str
    done: bool


# ---------------------------------------------------------------------------
# Stage 1 — root & health
# ---------------------------------------------------------------------------

@app.get("/", summary="API info", description="Describes this API and lists its main endpoints.")
def root():
    return {
        "name": "Task API",
        "version": "1.0",
        "endpoints": ["/tasks", "/tasks/{id}", "/health", "/stats"],
    }


@app.get("/health", summary="Health check", description="Returns ok if the server is alive.")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Stage 2 — Read
# ---------------------------------------------------------------------------

@app.get("/tasks", summary="List tasks", description="Returns all tasks, optionally filtered.")
def list_tasks(
    done: Optional[bool] = Query(None, description="Filter by done status"),
    search: Optional[str] = Query(None, description="Filter by text in the title"),
):
    result = tasks

    if done is not None:
        result = [t for t in result if t["done"] == done]

    if search:
        needle = search.lower()
        result = [t for t in result if needle in t["title"].lower()]

    return result


@app.get("/tasks/{task_id}", summary="Get one task", description="Returns a single task by id.")
def get_task(task_id: int):
    for t in tasks:
        if t["id"] == task_id:
            return t
    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


# ---------------------------------------------------------------------------
# Stage 3 — Create
# ---------------------------------------------------------------------------

@app.post(
    "/tasks",
    status_code=201,
    summary="Create a task",
    description="Creates a new task. Requires a non-empty title.",
)
def create_task(payload: TaskCreate):
    global next_id

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required and cannot be empty")

    new_task = {"id": next_id, "title": title, "done": False}
    tasks.append(new_task)
    next_id += 1
    return new_task


# ---------------------------------------------------------------------------
# Stage 4 — Update & Delete
# ---------------------------------------------------------------------------

@app.put(
    "/tasks/{task_id}",
    summary="Update a task",
    description="Replaces a task's title and/or done status.",
)
def update_task(task_id: int, payload: TaskUpdate):
    for t in tasks:
        if t["id"] == task_id:
            if payload.title is not None:
                title = payload.title.strip()
                if not title:
                    raise HTTPException(status_code=400, detail="title cannot be empty")
                t["title"] = title

            if payload.done is not None:
                t["done"] = payload.done

            if payload.title is None and payload.done is None:
                raise HTTPException(
                    status_code=400,
                    detail="provide at least one of: title, done",
                )

            return t

    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


@app.delete(
    "/tasks/{task_id}",
    status_code=204,
    summary="Delete a task",
    description="Removes a task by id. Returns no content.",
)
def delete_task(task_id: int):
    for i, t in enumerate(tasks):
        if t["id"] == task_id:
            tasks.pop(i)
            return Response(status_code=204)

    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


# ---------------------------------------------------------------------------
# Stretch extras — optional but fun
# ---------------------------------------------------------------------------

@app.get("/stats", summary="Stats", description="Quick counts: total / done / open tasks.")
def stats():
    total = len(tasks)
    done_count = sum(1 for t in tasks if t["done"])
    return {"total": total, "done": done_count, "open": total - done_count}


@app.post("/reset", summary="Reset", description="Restores the 3 example tasks. Handy for demos.")
def reset():
    global tasks, next_id
    tasks = [t.copy() for t in DEFAULT_TASKS]
    next_id = 4
    return {"message": "tasks reset", "tasks": tasks}
