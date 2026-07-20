const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('./package.json');

const app = express();
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: pkg.name,
      version: pkg.version,
      description: 'A simple RESTful Tasks API built with Node.js and Express.',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: ['./server.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

let nextId = 4;
const tasks = [
  { id: 1, title: 'Install tools', done: true },
  { id: 2, title: 'Build REST API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

const defaultTasks = [
  { id: 1, title: 'Install tools', done: true },
  { id: 2, title: 'Build REST API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

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
 *     description: Returns all tasks, optionally filtered and paginated.
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
 *         description: Search tasks by title
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
  let result = tasks;
  if (req.query.done !== undefined) {
    const done = req.query.done === 'true';
    result = result.filter((t) => t.done === done);
  }
  if (req.query.search) {
    const q = req.query.search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }
  const total = result.length;
  const limit = req.query.limit ? Number(req.query.limit) : result.length;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  result = result.slice(offset, offset + limit);
  res.json({ total, count: result.length, offset, limit, tasks: result });
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
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
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
  const task = { id: nextId++, title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
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
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, done } = req.body;
  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  if (title !== undefined) task.title = title.trim();
  if (done !== undefined) task.done = done;
  res.json(task);
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
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Task not found' });
  tasks.splice(index, 1);
  res.status(204).end();
});

/**
 * @openapi
 * /stats:
 *   get:
 *     summary: Task stats
 *     description: Returns counts of total, done, and pending tasks.
 *     responses:
 *       200:
 *         description: Task statistics
 */
app.get('/stats', (req, res) => {
  res.json({
    total: tasks.length,
    done: tasks.filter((t) => t.done).length,
    pending: tasks.filter((t) => !t.done).length,
  });
});

/**
 * @openapi
 * /reset:
 *   post:
 *     summary: Reset tasks
 *     description: Restores the 3 example tasks. Handy for demos.
 *     responses:
 *       200:
 *         description: Tasks reset to defaults
 */
app.post('/reset', (req, res) => {
  tasks.length = 0;
  tasks.push(...defaultTasks.map((t) => ({ ...t })));
  nextId = 4;
  res.json({ message: 'Tasks reset to defaults', tasks });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
