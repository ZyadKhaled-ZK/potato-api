# Potato API

A simple RESTful API for task management built with Node.js, Express, and PostgreSQL — running in Docker — with Supabase Auth.

Built for the FlyRank Internship — Backend Track — Week 2 — Assignment A4.

Three storage engines, one API: memory (A1) → SQLite (A2) → PostgreSQL in Docker (A3). Same endpoints, same responses — only the storage layer changed. Now with Supabase Auth (A4) protecting selected routes.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ZyadKhaled-ZK/potato-api.git
cd potato-api

# 2. Copy environment file and add your Supabase credentials
cp .env.example .env
# Edit .env and fill in SUPABASE_URL and SUPABASE_KEY from your Supabase project

# 3. Start everything (app + database)
docker compose up
```

The API runs at `http://localhost:3000`. Swagger UI at `http://localhost:3000/docs`.

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free for personal use), a [Supabase](https://supabase.com) project (free, no card)

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

| Method   | Endpoint               | Description                              | Auth      | Body                                | Status Codes         |
|----------|------------------------|------------------------------------------|-----------|-------------------------------------|----------------------|
| `GET`    | `/`                    | API info                                 | No        | -                                   | 200                  |
| `GET`    | `/health`              | Health check (pings DB)                  | No        | -                                   | 200, 503             |
| `GET`    | `/tasks`               | List tasks (`?done=`, `?search=`, `?sort=`, `?limit=`, `?offset=`) | No | -                | 200                  |
| `GET`    | `/tasks/:id`           | Get a single task                        | No        | -                                   | 200, 404             |
| `POST`   | `/tasks`               | Create a new task                        | No        | `{ "title": "..." }`                | 201, 400             |
| `PUT`    | `/tasks/:id`           | Update a task                            | No        | `{ "title": "...", "done": true }`  | 200, 400, 404        |
| `DELETE` | `/tasks/:id`           | Delete a task                            | No        | -                                   | 204, 404             |
| `GET`    | `/stats`               | Task counts (total / done / pending)     | No        | -                                   | 200                  |
| `POST`   | `/reset`               | Reset tasks to defaults                  | No        | -                                   | 200                  |
| `POST`   | `/auth/signup`         | Sign up a new user                       | No        | `{ "email": "...", "password": "..." }` | 201, 400, 409   |
| `POST`   | `/auth/login`          | Log in with email and password           | No        | `{ "email": "...", "password": "..." }` | 200, 400        |
| `POST`   | `/auth/logout`         | Log out the current user                 | Bearer    | -                                   | 200, 401             |
| `GET`    | `/public/info`         | Public endpoint (no auth needed)         | No        | -                                   | 200                  |
| `GET`    | `/protected/profile`   | Get the authenticated user's profile     | Bearer    | -                                   | 200, 401             |
| `GET`    | `/protected/dashboard` | Protected dashboard (requires valid token) | Bearer  | -                                   | 200, 401             |

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

### Sign up

```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
```

```
HTTP/1.1 201 Created

{"user":{"id":"...","email":"test@example.com"},"access_token":"eyJhbG..."}
```

### Login

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
```

```
HTTP/1.1 200 OK

{"user":{"id":"...","email":"test@example.com"},"access_token":"eyJhbG..."}
```

### Access protected route (with token)

```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer eyJhbG..."
```

```
HTTP/1.1 200 OK

{"user":{"id":"...","email":"test@example.com","role":"authenticated"}}
```

### Access protected route (without token)

```bash
curl -i http://localhost:3000/protected/profile
```

```
HTTP/1.1 401 Unauthorized

{"error":"Missing or invalid Authorization header"}
```

### Logout

```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbG..."
```

```
HTTP/1.1 200 OK

{"message":"Logged out successfully"}
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
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon/public key | `eyJhbG...` |

See `.env.example` for all required variables.

## Project Structure

```
potato-api/
  server.js         # Express app with all routes + auth
  db.js             # PostgreSQL connection, table creation, seed
  supabase.js       # Supabase client initialization
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

## AI vs Me (Week 2 — Auth with Supabase)

### My Prompt

> Add Supabase Auth to the existing Express API. Use @supabase/supabase-js client.
> Create routes: POST /auth/signup, POST /auth/login, POST /auth/logout, GET /public/info,
> GET /protected/profile, GET /protected/dashboard. Verify tokens via supabase.auth.getUser().
> Use bearer token in Authorization header. Swagger UI with bearer auth security scheme.
> All new auth routes documented with JSDoc @openapi annotations. Keep existing CRUD routes unchanged.

### What the AI Did Better

- Added `tags: [Auth]` / `[Protected]` / `[Public]` in Swagger — groups endpoints nicely.
- Created a separate `supabase.js` module for clean client initialization.
- Used `verifyToken` middleware consistently across all protected routes.

### What It Got Wrong or Ignored

- Didn't ask for an `.env.example` update — I had to add `SUPABASE_URL` and `SUPABASE_KEY` manually.
- YAML parsing error in existing JSDoc comment (`description: Sort results by field (default: id)`) — the colon broke the YAML parser. Had to quote it.

### What My Prompt Forgot

- Didn't specify how logout should work (admin signOut vs client signOut) — the AI chose `admin.signOut` which requires a service key. For client-side apps, `supabase.auth.signOut()` is sufficient.
- Didn't mention Swagger tags — the AI added them anyway.
- Didn't mention `.env.example` update — the AI missed it initially.

### Second Prompt Change

Added requirements for: .env.example update with SUPABASE_URL and SUPABASE_KEY, quoted YAML descriptions, and client-side logout via `supabase.auth.signOut()` instead of admin signOut. The second version matched my hand-built implementation.

## License

ISC
