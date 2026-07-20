# Potato API

A simple RESTful API for task management built with Node.js and Express.

Built for the FlyRank Internship — Backend Track — Week 2 — Assignment A1.

Data lives only in memory: restart the server and it resets to 3 example tasks.
Persistence (a real database) is next week's lesson.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ZyadKhaled-ZK/potato-api.git
cd potato-api

# 2. Install dependencies
npm install

# 3. Start the server
node server.js
```

The server runs at `http://localhost:3000`. Open `http://localhost:3000/docs` for Swagger UI.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

## Endpoints

| Method   | Endpoint      | Description                              | Body                          | Status Codes         |
|----------|---------------|------------------------------------------|-------------------------------|----------------------|
| `GET`    | `/`           | API info                                 | -                             | 200                  |
| `GET`    | `/health`     | Health check                             | -                             | 200                  |
| `GET`    | `/tasks`      | List tasks (`?done=`, `?search=`, `?limit=`, `?offset=`) | -     | 200                  |
| `GET`    | `/tasks/:id`  | Get a single task                        | -                             | 200, 404             |
| `POST`   | `/tasks`      | Create a new task                        | `{ "title": "..." }`          | 201, 400             |
| `PUT`    | `/tasks/:id`  | Update a task                            | `{ "title": "...", "done": }` | 200, 400, 404        |
| `DELETE` | `/tasks/:id`  | Delete a task                            | -                             | 204, 404             |
| `GET`    | `/stats`      | Task counts (total / done / pending)     | -                             | 200                  |
| `POST`   | `/reset`      | Reset tasks to defaults                  | -                             | 200                  |

Every error response has the shape `{ "error": "..." }`.

## Examples (curl -i)

### List all tasks

```bash
curl -i http://localhost:3000/tasks
```

```
HTTP/1.1 200 OK
Content-Type: application/json

[{"id":1,"title":"Install tools","done":true},{"id":2,"title":"Build REST API","done":false},{"id":3,"title":"Write tests","done":false}]
```

### Get a single task

```bash
curl -i http://localhost:3000/tasks/1
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{"id":1,"title":"Install tools","done":true}
```

### Create a task

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Docker"}'
```

```
HTTP/1.1 201 Created
Content-Type: application/json

{"id":4,"title":"Learn Docker","done":false}
```

### Update a task

```bash
curl -i -X PUT http://localhost:3000/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{"id":2,"title":"Build REST API","done":true}
```

### Delete a task

```bash
curl -i -X DELETE http://localhost:3000/tasks/3
```

```
HTTP/1.1 204 No Content
```

### Validation error

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{}'
```

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":"Title is required"}
```

### Task not found

```bash
curl -i http://localhost:3000/tasks/99
```

```
HTTP/1.1 404 Not Found
Content-Type: application/json

{"error":"Task not found"}
```

### Pagination

```bash
curl -i "http://localhost:3000/tasks?limit=2&offset=1"
```

```
HTTP/1.1 200 OK
Content-Type: application/json

[{"id":2,"title":"Build REST API","done":false},{"id":3,"title":"Write tests","done":false}]
```

Real APIs never return everything by default — pagination prevents overloading the client with massive datasets.

## Swagger UI

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

You can test every endpoint directly from the browser using the **Try it out** button.

![Swagger UI](./Screenshot_20.png)

## The Mortality Experiment

Create a few tasks, restart the server (`Ctrl+C`, run `node server.js` again), then
`GET /tasks`. The list is back to the 3 default tasks — everything you added is gone.
That's because tasks live in a plain JavaScript array in memory, not on disk. The server
process holding that array is the only place the data ever existed; killing the process
kills the data with it. This is exactly why Week 3 introduces a real database: something
that survives a restart.

## AI vs Me

### My Prompt

> Build a REST API with Python and FastAPI that manages a to-do list. It should have
> these endpoints: GET / returning API info, GET /health, GET /tasks (with filtering by
> done status and text search), GET /tasks/{id}, POST /tasks with validation (empty title
> → 400), PUT /tasks/{id}, DELETE /tasks/{id} (204), GET /stats, POST /reset. All data
> in memory, no database. Swagger UI should work at /docs.

### What the AI Did Better

- Used Pydantic models for automatic request validation (cleaner than manual checks).
- Custom exception handlers to normalize all errors to `{ "error": "..." }` — mine sometimes returns different shapes.
- Added `summary` and `description` on every route — Swagger UI looks more polished.

### What It Got Wrong or Ignored

- Used `global` keyword for `tasks` and `next_id` — works but is not ideal Python practice.
- Missing pagination (`?limit=&offset=`) — I had to add it myself.
- Returns 422 (FastAPI default) for validation errors instead of 400 — I had to write a custom handler to fix this.

### What My Prompt Forgot

- Didn't specify pagination — the AI silently decided not to include it.
- Didn't specify error response shape (`{ "error": "..." }`) — the AI chose it, which happened to match.
- Didn't mention CORS or deployment — the AI correctly ignored both (not needed for this assignment).

### Second Prompt Change

Added explicit requirements for pagination, error response format, and status code 400 for validation errors. The second version was closer to my hand-built API.

## Project Structure

```
potato-api/
  server.js        # Express app with all routes + swagger-jsdoc JSDoc comments
  package.json     # Dependencies and scripts
  .gitignore
  README.md
  ai/              # AI-generated version (FastAPI)
```

## License

ISC
