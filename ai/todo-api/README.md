# Task API

A small in-memory CRUD API for managing a to-do list, built with **Python + FastAPI**.
Built for the FlyRank Internship — Backend Track — Week 2 — Assignment A1.

Data lives only in memory: restart the server and it resets to 3 example tasks.
Persistence (a real database) is next week's lesson.

## What this is

Five REST endpoints implementing full CRUD (Create, Read, Update, Delete) on a list of
tasks, plus a couple of small extras (filtering, search, stats, reset). Interactive
Swagger UI documentation is generated automatically by FastAPI — no extra setup needed.

## How to install & run

Requires Python 3.10+.

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open:
- **http://localhost:8000** — API info
- **http://localhost:8000/docs** — Swagger UI (interactive docs, "Try it out" works here)
- **http://localhost:8000/health** — health check

## Endpoints

| Method | Path            | Description                          | Success | Errors        |
|--------|-----------------|---------------------------------------|---------|----------------|
| GET    | `/`             | API info                              | 200     | —              |
| GET    | `/health`       | Health check                          | 200     | —              |
| GET    | `/tasks`        | List all tasks (supports `?done=` and `?search=`) | 200 | — |
| GET    | `/tasks/{id}`   | Get one task                          | 200     | 404 not found  |
| POST   | `/tasks`        | Create a task (`{"title": "..."}`)    | 201     | 400 invalid body |
| PUT    | `/tasks/{id}`   | Update a task's title and/or done     | 200     | 400 invalid body, 404 not found |
| DELETE | `/tasks/{id}`   | Delete a task                         | 204     | 404 not found  |
| GET    | `/stats`        | Counts: total / done / open           | 200     | —              |
| POST   | `/reset`        | Restore the 3 example tasks           | 200     | —              |

Every error response has the shape `{ "error": "..." }`.

## Example: curl

```bash
$ curl -i http://localhost:8000/tasks/1
HTTP/1.1 200 OK
content-type: application/json

{"id":1,"title":"Buy milk","done":false}

$ curl -i -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
HTTP/1.1 201 Created
content-type: application/json

{"id":4,"title":"Buy milk","done":false}

$ curl -i http://localhost:8000/tasks/99
HTTP/1.1 404 Not Found
content-type: application/json

{"error":"Task 99 not found"}
```

## Full CRUD cycle (manual test)

```bash
curl -X POST   http://localhost:8000/tasks -d '{"title":"Walk the dog"}' -H "Content-Type: application/json"  # 201
curl            http://localhost:8000/tasks                                                                    # 200, shows new task
curl -X PUT    http://localhost:8000/tasks/4 -d '{"done":true}' -H "Content-Type: application/json"            # 200
curl -X DELETE http://localhost:8000/tasks/4                                                                    # 204
curl            http://localhost:8000/tasks                                                                    # 200, task gone
```

## Swagger UI

Visit `http://localhost:8000/docs` after starting the server. Every endpoint above is
listed with a description, and the **"Try it out"** button lets you run the full CRUD
cycle (create → list → update → delete) directly from the browser, without curl.

*(Add your own screenshot of `/docs` here before submitting — e.g. `docs-screenshot.png`.)*

## The mortality experiment

Create a few tasks, then restart the server (`Ctrl+C`, run `uvicorn` again), then
`GET /tasks`. The list is back to the 3 default tasks — everything you added is gone.
That's because tasks live in a plain Python list in memory, not on disk. The server
process holding that list is the only place the data ever existed; killing the process
kills the data with it. This is exactly why Week 3 introduces a real database: something
that survives a restart.

## Project structure

```
todo-api/
├── main.py            # the whole API
├── requirements.txt   # fastapi + uvicorn
├── .gitignore
└── README.md
```
