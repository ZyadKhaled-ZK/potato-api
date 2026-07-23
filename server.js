const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('./package.json');
const db = require('./db');

const app = express();
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: pkg.name,
      version: pkg.version,
      description: 'A simple RESTful Tasks API built with Node.js, Express, and SQLite.',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: ['./server.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const stmts = {
  all: db.prepare('SELECT * FROM tasks ORDER BY id'),
  byId: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  insert: db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)'),
  update: db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM tasks WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM tasks'),
  countDone: db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE done = 1'),
  reset: db.prepare('DELETE FROM tasks'),
  seed: db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)'),
};

function toBool(task) {
  return task ? { ...task, done: !!task.done } : null;
}

function toBoolAll(tasks) {
  return tasks.map(toBool);
}

/**
 * @openapi
 * /:
 *   get:
 *     summary: API info
 *     description: Returns the API name, version, and available endpoints.
 *     responses:
 *       200:
 *         description: API info
 */
app.get('/', (req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    endpoints: ['/', '/health', '/tasks', '/tasks/:id', '/stats', '/reset'],
  });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns ok if the server is alive.
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /tasks:
 *   get:
 *     summary: List tasks
 *     description: Returns tasks, optionally filtered and paginated.
 *     parameters:
 *       - in: query
 *         name: done
 *         schema:
 *           type: boolean
 *         description: Filter by done status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search tasks by title (SQL LIKE)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max number of tasks to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of tasks to skip
 *     responses:
 *       200:
 *         description: List of tasks with pagination info
 */
app.get('/tasks', (req, res) => {
  let where = [];
  let params = [];

  if (req.query.done !== undefined) {
    where.push('done = ?');
    params.push(req.query.done === 'true' ? 1 : 0);
  }
  if (req.query.search) {
    where.push('title LIKE ?');
    params.push(`%${req.query.search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tasks ${whereClause}`).get(...params).n;

  const limit = req.query.limit ? Number(req.query.limit) : total;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const tasks = db.prepare(`SELECT * FROM tasks ${whereClause} ORDER BY id LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({ total, count: tasks.length, offset, limit, tasks: toBoolAll(tasks) });
});

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     summary: Get one task
 *     description: Returns a single task by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A single task
 *       404:
 *         description: Task not found
 */
app.get('/tasks/:id', (req, res) => {
  const task = stmts.byId.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(toBool(task));
});

/**
 * @openapi
 * /tasks:
 *   post:
 *     summary: Create a task
 *     description: Creates a new task. Requires a non-empty title.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Buy milk
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Title is required
 */
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const result = stmts.insert.run(title.trim(), 0);
  const task = stmts.byId.get(result.lastInsertRowid);
  res.status(201).json(toBool(task));
});

/**
 * @openapi
 * /tasks/{id}:
 *   put:
 *     summary: Update a task
 *     description: Replaces a task's title and/or done status.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               done:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Task updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Task not found
 */
app.put('/tasks/:id', (req, res) => {
  const existing = stmts.byId.get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const { title, done } = req.body;
  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDone = done !== undefined ? (done ? 1 : 0) : existing.done;
  stmts.update.run(newTitle, newDone, existing.id);
  res.json(toBool(stmts.byId.get(existing.id)));
});

/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     description: Removes a task by id. Returns no content.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Task deleted
 *       404:
 *         description: Task not found
 */
app.delete('/tasks/:id', (req, res) => {
  const existing = stmts.byId.get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  stmts.delete.run(existing.id);
  res.status(204).end();
});

/**
 * @openapi
 * /stats:
 *   get:
 *     summary: Task stats
 *     description: Returns counts of total, done, and pending tasks using SQL COUNT.
 *     responses:
 *       200:
 *         description: Task statistics
 */
app.get('/stats', (req, res) => {
  const total = stmts.count.get().n;
  const done = stmts.countDone.get().n;
  res.json({ total, done, pending: total - done });
});

/**
 * @openapi
 * /reset:
 *   post:
 *     summary: Reset tasks
 *     description: Deletes all tasks and re-seeds the 3 example tasks.
 *     responses:
 *       200:
 *         description: Tasks reset to defaults
 */
app.post('/reset', (req, res) => {
  const resetAll = db.transaction(() => {
    stmts.reset.run();
    stmts.seed.run('Install tools', 1);
    stmts.seed.run('Build REST API', 0);
    stmts.seed.run('Write tests', 0);
  });
  resetAll();
  const tasks = stmts.all.all();
  res.json({ message: 'Tasks reset to defaults', tasks: toBoolAll(tasks) });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
