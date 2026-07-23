# Potato API

A simple RESTful API for task management built with Node.js, Express, and PostgreSQL — running in Docker.

Built for the FlyRank Internship — Backend Track — Week 1 — Assignment A3.

Three storage engines, one API: memory (A1) → SQLite (A2) → PostgreSQL in Docker (A3). Same endpoints, same responses — only the storage layer changed.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ZyadKhaled-ZK/potato-api.git
cd potato-api

# 2. Copy environment file
cp .env.example .env

# 3. Start everything (app + database)
docker compose up
```

The API runs at `http://localhost:3000`. Swagger UI at `http://localhost:3000/docs`.

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free for personal use)

## How It Works

```
Client → Express API (port 3000) → PostgreSQL (port 5432, in Docker container)
```

- **Docker** packages your app and database into containers — identical behavior on every machine.
- **A volume** (`taskdata`) keeps your rows alive across `docker compose down` / `up` cycles.
- **`.env`** holds your database URL — never committed to Git.

## Why PostgreSQL?

PostgreSQL is a powerful, free, open-source database server — the engine behind a huge share of real backends. Unlike SQLite (a file), Postgres runs as its own program, supporting concurrent connections, advanced queries, and production workloads. Docker makes it trivial to run locally.

## Endpoints

| Method   | Endpoint      | Description                              | Body                          | Status Codes         |
|----------|---------------|------------------------------------------|-------------------------------|----------------------|
| `GET`    | `/`           | API info                                 | -                             | 200                  |
| `GET`    | `/health`     | Health check (pings DB)                  | -                             | 200, 503             |
| `GET`    | `/tasks`      | List tasks (`?done=`, `?search=`, `?sort=`, `?limit=`, `?offset=`) | -  | 200                  |
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

{"total":3,"count":3,"offset":0,"limit":3,"tasks":[{"id":1,"title":"Install tools","done":true,"created_at":"...","updated_at":"..."},{"id":2,"title":"Build REST API","done":false,...},{"id":3,"title":"Write tests","done":false,...}]}
```

### Get a single task

```bash
curl -i http://localhost:3000/tasks/1
```

```
HTTP/1.1 200 OK

{"id":1,"title":"Install tools","done":true,"created_at":"...","updated_at":"..."}
```

### Create a task

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Docker"}'
```

```
HTTP/1.1 201 Created

{"id":4,"title":"Learn Docker","done":false,"created_at":"...","updated_at":"..."}
```

### Update a task

```bash
curl -i -X PUT http://localhost:3000/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

```
HTTP/1.1 200 OK

{"id":2,"title":"Build REST API","done":true,"created_at":"...","updated_at":"..."}
```

### Delete a task

```bash
curl -i -X DELETE http://localhost:3000/tasks/3
```

```
HTTP/1.1 204 No Content
```

### Health check (with DB ping)

```bash
curl -i http://localhost:3000/health
```

```
HTTP/1.1 200 OK

{"status":"ok","db":"ok"}
```

### Validation error

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{}'
```

```
HTTP/1.1 400 Bad Request

{"error":"Title is required"}
```

## Persistence Proof

```bash
# Create a task
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Survives restart"}'

# Stop everything
docker compose down

# Start everything — data survives because of the volume
docker compose up

# Task is still there
curl http://localhost:3000/tasks
```

## Database Screenshot

Connect to Postgres inside the container:

```bash
docker exec -it potato-db-1 psql -U postgres -d tasks
```

```sql
\t
SELECT * FROM tasks;
```

![Postgres Screenshot](./Screenshot_db.png)

## API Did Not Change

The same A1/A2 curl tests pass against Postgres — identical behavior across three storage engines proves storage is "just an implementation detail":

```bash
curl -i http://localhost:3000/tasks          # 200 + three tasks
curl -i http://localhost:3000/tasks/1        # 200 + one task
curl -i http://localhost:3000/tasks/99       # 404
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'                      # 201
curl -i -X DELETE http://localhost:3000/tasks/1  # 204
```

## Swagger UI

Interactive API documentation at `http://localhost:3000/docs`.

![Swagger UI](./Screenshot_20.png)

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://postgres:dev@localhost:5432/tasks` |

See `.env.example` for all required variables.

## Project Structure

```
potato-api/
  server.js         # Express app with all routes
  db.js             # PostgreSQL connection, table creation, seed
  Dockerfile        # App container image
  compose.yaml      # App + Postgres stack
  .env.example      # Template for secrets (committed)
  .env              # Real secrets (git-ignored)
  .dockerignore     # Files excluded from Docker build
  package.json
  .gitignore
  README.md
  ai/               # AI-generated version
```

## AI vs Me (Week 3 — Docker + Postgres Migration)

### My Prompt

> Containerize a Node.js Express CRUD API with PostgreSQL in Docker. Use pg (node-postgres)
> driver. Create a tasks table with id SERIAL PRIMARY KEY, title TEXT, done BOOLEAN,
> created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ. Create table if missing, seed 3 tasks
> only when empty. All 5 CRUD endpoints keep identical shapes. Use parameterized queries
> ($1, $2 placeholders). Connection string from .env (DATABASE_URL), never hardcoded.
> Docker compose with two services: api (built from Dockerfile) and db (postgres image).
> Volume for data persistence. Health check endpoint that pings the database. One command:
> docker compose up.

### What the AI Did Better

- Added `depends_on` with `condition: service_healthy` — waits for Postgres to be ready before starting the app.
- Included a proper healthcheck in compose.yaml for the db service.
- Used `RETURNING *` in INSERT — cleaner than a separate SELECT after insert.

### What It Got Wrong or Ignored

- Hardcoded the password in compose.yaml instead of reading from .env file.
- Missing `.dockerignore` — would copy node_modules into the image.
- Used `restart: always` instead of `restart: unless-stopped` — unnecessary for development.

### What My Prompt Forgot

- Didn't specify `.dockerignore` — the AI silently added it.
- Didn't mention `depends_on` conditions — the AI chose `service_healthy` which is better than just `service_started`.
- Didn't specify multi-stage build — the AI used a single stage (acceptable for this assignment).

### Second Prompt Change

Added requirements for: .dockerignore, depends_on with health condition, .env-based configuration inside compose, and restart policy. The second version matched my hand-built implementation.

## License

ISC
