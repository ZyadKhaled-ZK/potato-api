# Potato API

A simple RESTful API for task management built with Node.js and Express.

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

| Method   | Endpoint      | Description              | Body                          | Status Codes         |
|----------|---------------|--------------------------|-------------------------------|----------------------|
| `GET`    | `/`           | API info                 | -                             | 200                  |
| `GET`    | `/health`     | Health check             | -                             | 200                  |
| `GET`    | `/tasks`      | List all tasks           | -                             | 200                  |
| `GET`    | `/tasks/:id`  | Get a single task        | -                             | 200, 404             |
| `POST`   | `/tasks`      | Create a new task        | `{ "title": "..." }`          | 201, 400             |
| `PUT`    | `/tasks/:id`  | Update a task            | `{ "title": "...", "done": }` | 200, 400, 404        |
| `DELETE` | `/tasks/:id`  | Delete a task            | -                             | 204, 404             |

## Examples

### Get all tasks

```bash
curl http://localhost:3000/tasks
```

```json
[
  { "id": 1, "title": "Install tools", "done": true },
  { "id": 2, "title": "Build REST API", "done": false },
  { "id": 3, "title": "Write tests", "done": false }
]
```

### Get a single task

```bash
curl http://localhost:3000/tasks/1
```

```json
{ "id": 1, "title": "Install tools", "done": true }
```

### Create a task

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Docker"}'
```

```json
{ "id": 4, "title": "Learn Docker", "done": false }
```

### Update a task

```bash
curl -X PUT http://localhost:3000/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{"title": "Build REST API", "done": true}'
```

```json
{ "id": 2, "title": "Build REST API", "done": true }
```

### Delete a task

```bash
curl -X DELETE http://localhost:3000/tasks/3
```

Returns `204 No Content`.

### Validation error

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{ "error": "Title is required" }
```

## Swagger UI

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

You can test every endpoint directly from the browser using the **Try it out** button.

## Project Structure

```
potato-api/
  server.js        # Express app with all routes
  openapi.json     # OpenAPI 3.0 specification
  package.json     # Dependencies and scripts
  .gitignore
  README.md
```

## License

ISC
