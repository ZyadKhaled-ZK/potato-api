require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('./package.json');
const { pool, init } = require('./db');
const supabase = require('./supabase');

const app = express();
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: pkg.name,
      version: pkg.version,
      description: 'A simple RESTful Tasks API built with Node.js, Express, and PostgreSQL with Supabase Auth.',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token',
        },
      },
    },
  },
  apis: ['./server.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

function toBool(task) {
  return task ? { ...task, done: !!task.done } : null;
}

function toBoolAll(tasks) {
  return tasks.map(toBool);
}

async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = data.user;
  next();
}

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Sign up a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       201:
 *         description: User created, returns access token
 *       400:
 *         description: Invalid input
 *       409:
 *         description: User already exists
 */
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const status = error.message.includes('already') ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }
  res.status(201).json({
    user: { id: data.user.id, email: data.user.email },
    access_token: data.session?.access_token,
  });
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful, returns access token
 *       400:
 *         description: Invalid credentials
 */
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.json({
    user: { id: data.user.id, email: data.user.email },
    access_token: data.session.access_token,
  });
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
app.post('/auth/logout', verifyToken, async (req, res) => {
  const { error } = await supabase.auth.admin.signOut(req.headers.authorization.split(' ')[1]);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ message: 'Logged out successfully' });
});

/**
 * @openapi
 * /public/info:
 *   get:
 *     summary: Public endpoint (no auth needed)
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public info
 */
app.get('/public/info', (req, res) => {
  res.json({ message: 'This is a public endpoint — no authentication required.' });
});

/**
 * @openapi
 * /protected/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Not authenticated
 */
app.get('/protected/profile', verifyToken, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
});

/**
 * @openapi
 * /protected/dashboard:
 *   get:
 *     summary: Protected dashboard (requires valid token)
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         description: Not authenticated
 */
app.get('/protected/dashboard', verifyToken, (req, res) => {
  res.json({ message: `Welcome, ${req.user.email}! This is your protected dashboard.` });
});

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
    endpoints: ['/', '/health', '/tasks', '/tasks/:id', '/stats', '/reset', '/auth/signup', '/auth/login', '/auth/logout', '/public/info', '/protected/profile', '/protected/dashboard'],
  });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns ok if the server is alive. Also pings the database.
 *     responses:
 *       200:
 *         description: Server and database are healthy
 *       503:
 *         description: Database unreachable
 */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [id, title, created_at]
 *         description: "Sort results by field (default: id)"
 *     responses:
 *       200:
 *         description: List of tasks with pagination info
 */
app.get('/tasks', async (req, res) => {
  let where = [];
  let params = [];
  let paramIndex = 1;

  if (req.query.done !== undefined) {
    where.push(`done = $${paramIndex++}`);
    params.push(req.query.done === 'true');
  }
  if (req.query.search) {
    where.push(`title ILIKE $${paramIndex++}`);
    params.push(`%${req.query.search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await pool.query(`SELECT COUNT(*) AS n FROM tasks ${whereClause}`, params);
  const total = Number(countResult.rows[0].n);

  const sortField = ['id', 'title', 'created_at'].includes(req.query.sort) ? req.query.sort : 'id';
  const limit = req.query.limit ? Number(req.query.limit) : total;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const tasksResult = await pool.query(
    `SELECT * FROM tasks ${whereClause} ORDER BY ${sortField} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  res.json({ total, count: tasksResult.rows.length, offset, limit, tasks: toBoolAll(tasksResult.rows) });
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
app.get('/tasks/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [Number(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Task not found' });
  res.json(toBool(rows[0]));
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
app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [title.trim(), false]
  );
  res.status(201).json(toBool(rows[0]));
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
app.put('/tasks/:id', async (req, res) => {
  const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [Number(req.params.id)]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
  const current = existing.rows[0];
  const { title, done } = req.body;
  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  const newTitle = title !== undefined ? title.trim() : current.title;
  const newDone = done !== undefined ? done : current.done;
  const { rows } = await pool.query(
    "UPDATE tasks SET title = $1, done = $2, updated_at = now() WHERE id = $3 RETURNING *",
    [newTitle, newDone, current.id]
  );
  res.json(toBool(rows[0]));
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
app.delete('/tasks/:id', async (req, res) => {
  const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [Number(req.params.id)]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
  await pool.query('DELETE FROM tasks WHERE id = $1', [existing.rows[0].id]);
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
app.get('/stats', async (req, res) => {
  const total = await pool.query('SELECT COUNT(*) AS n FROM tasks');
  const done = await pool.query('SELECT COUNT(*) AS n FROM tasks WHERE done = true');
  const t = Number(total.rows[0].n);
  const d = Number(done.rows[0].n);
  res.json({ total: t, done: d, pending: t - d });
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
app.post('/reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks');
    await client.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2), ($3, $4), ($5, $6)',
      ['Install tools', true, 'Build REST API', false, 'Write tests', false]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
  res.json({ message: 'Tasks reset to defaults', tasks: toBoolAll(rows) });
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.warn('Warning: Database unavailable — task routes will fail:', err.message);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT} (no database)`);
    });
  });
