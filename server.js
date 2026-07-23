require('dotenv').config();
const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('./package.json');
const { pool, init } = require('./db');
const supabase = require('./supabase');
const { enrichIp } = require('./geo');
const { getClientIp, isSpam, rateLimiter, cleanupRateLimits } = require('./spam');

const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));

app.use('/widget.js', express.static(path.join(__dirname, 'public', 'widget.js'), {
  maxAge: '1h',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    res.setHeader('Content-Type', 'application/javascript');
  },
}));

app.use('/demo', express.static(path.join(__dirname, 'public', 'customer-site.html'), {
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'text/html');
  },
}));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Potato Widget Platform',
      version: '2.0.0',
      description: 'Embeddable widget & lead-capture platform with geo enrichment, spam protection, and cached config delivery.',
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
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
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
 *         description: Logged out
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
 * /api/widgets:
 *   post:
 *     summary: Create a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, type]
 *             properties:
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [popover, signup, cta]
 *               description:
 *                 type: string
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *               targeting:
 *                 type: object
 *               button_text:
 *                 type: string
 *               theme:
 *                 type: object
 *     responses:
 *       201:
 *         description: Widget created
 *       400:
 *         description: Invalid input
 */
app.post('/api/widgets', verifyToken, async (req, res) => {
  const { title, type, description, fields, targeting, button_text, theme } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const validTypes = ['popover', 'signup', 'cta'];
  const widgetType = validTypes.includes(type) ? type : 'popover';

  const { rows } = await pool.query(
    `INSERT INTO widgets (owner_id, type, title, description, fields, targeting, button_text, theme)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      req.user.id,
      widgetType,
      title.trim(),
      description || '',
      JSON.stringify(fields || []),
      JSON.stringify(targeting || {}),
      button_text || 'Submit',
      JSON.stringify(theme || {}),
    ]
  );
  res.status(201).json(rows[0]);
});

/**
 * @openapi
 * /api/widgets:
 *   get:
 *     summary: List widgets
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of widgets
 */
app.get('/api/widgets', verifyToken, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM widgets WHERE owner_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

/**
 * @openapi
 * /api/widgets/{id}:
 *   get:
 *     summary: Get a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Widget details
 *       404:
 *         description: Widget not found
 */
app.get('/api/widgets/:id', verifyToken, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM widgets WHERE id = $1 AND owner_id = $2',
    [Number(req.params.id), req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Widget not found' });
  res.json(rows[0]);
});

/**
 * @openapi
 * /api/widgets/{id}:
 *   put:
 *     summary: Update a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
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
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               fields:
 *                 type: array
 *               targeting:
 *                 type: object
 *               button_text:
 *                 type: string
 *               theme:
 *                 type: object
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Widget updated
 *       404:
 *         description: Widget not found
 */
app.put('/api/widgets/:id', verifyToken, async (req, res) => {
  const existing = await pool.query(
    'SELECT * FROM widgets WHERE id = $1 AND owner_id = $2',
    [Number(req.params.id), req.user.id]
  );
  if (!existing.rows.length) return res.status(404).json({ error: 'Widget not found' });
  const current = existing.rows[0];
  const { title, type, description, fields, targeting, button_text, theme, is_active } = req.body;

  const newTitle = title !== undefined ? title.trim() : current.title;
  const newType = type !== undefined ? type : current.type;
  const newDesc = description !== undefined ? description : current.description;
  const newFields = fields !== undefined ? JSON.stringify(fields) : JSON.stringify(current.fields);
  const newTargeting = targeting !== undefined ? JSON.stringify(targeting) : JSON.stringify(current.targeting);
  const newBtn = button_text !== undefined ? button_text : current.button_text;
  const newTheme = theme !== undefined ? JSON.stringify(theme) : JSON.stringify(current.theme);
  const newActive = is_active !== undefined ? is_active : current.is_active;

  const { rows } = await pool.query(
    `UPDATE widgets SET type=$1, title=$2, description=$3, fields=$4, targeting=$5,
     button_text=$6, theme=$7, is_active=$8, updated_at=now()
     WHERE id=$9 AND owner_id=$10 RETURNING *`,
    [newType, newTitle, newDesc, newFields, newTargeting, newBtn, newTheme, newActive, current.id, req.user.id]
  );
  res.json(rows[0]);
});

/**
 * @openapi
 * /api/widgets/{id}:
 *   delete:
 *     summary: Delete a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Widget deleted
 *       404:
 *         description: Widget not found
 */
app.delete('/api/widgets/:id', verifyToken, async (req, res) => {
  const existing = await pool.query(
    'SELECT * FROM widgets WHERE id = $1 AND owner_id = $2',
    [Number(req.params.id), req.user.id]
  );
  if (!existing.rows.length) return res.status(404).json({ error: 'Widget not found' });
  await pool.query('DELETE FROM widgets WHERE id = $1', [existing.rows[0].id]);
  res.status(204).end();
});

/**
 * @openapi
 * /api/widgets/{id}/snippet:
 *   get:
 *     summary: Get embed snippet for a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Embed snippet HTML
 *       404:
 *         description: Widget not found
 */
app.get('/api/widgets/:id/snippet', verifyToken, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM widgets WHERE id = $1 AND owner_id = $2',
    [Number(req.params.id), req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Widget not found' });
  const widget = rows[0];
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const snippet = `<script src="${baseUrl}/widget.js" data-widget-id="${widget.id}" data-api-base="${baseUrl}" async></script>`;
  res.json({ widget_id: widget.id, snippet, instructions: 'Paste this before </body> on your site.' });
});

/**
 * @openapi
 * /api/widgets/{id}/config:
 *   get:
 *     summary: Get widget config (public, cached)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Widget config
 *       404:
 *         description: Widget not found or inactive
 */
app.get('/api/widgets/:id/config', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, type, title, description, fields, targeting, button_text, theme FROM widgets WHERE id = $1 AND is_active = true',
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Widget not found' });

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.setHeader('ETag', `W/"config-${rows[0].id}-${rows[0].updated_at?.getTime?.() || Date.now()}"`);
    res.json(rows[0]);
  } catch (err) {
    console.error('Config error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/submissions:
 *   post:
 *     summary: Submit a widget form (public, CORS)
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [widget_id, data]
 *             properties:
 *               widget_id:
 *                 type: integer
 *               data:
 *                 type: object
 *               _hp:
 *                 type: string
 *                 description: Honeypot field (must be empty)
 *     responses:
 *       201:
 *         description: Submission received
 *       400:
 *         description: Invalid input
 *       429:
 *         description: Rate limited
 */
app.post('/api/submissions', async (req, res) => {
  try {
    const { widget_id, data, _hp } = req.body;

    if (!widget_id) {
      return res.status(400).json({ error: 'widget_id is required' });
    }
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'data object is required' });
    }

    const { rows: widgetRows } = await pool.query(
      'SELECT id, fields FROM widgets WHERE id = $1 AND is_active = true',
      [widget_id]
    );
    if (!widgetRows.length) {
      return res.status(404).json({ error: 'Widget not found or inactive' });
    }

    const ip = getClientIp(req);
    const allowed = await rateLimiter(pool, ip, widget_id);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const widget = widgetRows[0];
    const honeypotField = (widget.fields || []).find(f => f.honeypot)?.name;
    const spam = isSpam(data, honeypotField) || (_hp && _hp.length > 0);

    const geo = await enrichIp(ip);

    const { rows } = await pool.query(
      `INSERT INTO submissions (widget_id, data, ip_address, user_agent, geo, is_spam)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [widget_id, JSON.stringify(data), ip, req.headers['user-agent'] || '', JSON.stringify(geo), spam]
    );

    processSideEffects(rows[0], widget).catch(err => {
      console.warn('Side effect failed (non-fatal):', err.message);
    });

    res.status(201).json({ id: rows[0].id, message: 'Submission received' });
  } catch (err) {
    console.error('Submission error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processSideEffects(submission, widget) {
  if (submission.is_spam) return;

  if (process.env.WEBHOOK_URL) {
    try {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_id: widget.id,
          widget_title: widget.title,
          submission_id: submission.id,
          data: submission.data,
          geo: submission.geo,
          submitted_at: submission.created_at,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('Webhook failed:', err.message);
    }
  }

  if (process.env.NOTIFICATION_EMAIL && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Widget Platform <noreply@example.com>',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `New submission for "${widget.title}"`,
          html: `<p>New submission received for widget <strong>${widget.title}</strong>.</p>
                 <pre>${JSON.stringify(submission.data, null, 2)}</pre>
                 <p>Geo: ${submission.geo?.city}, ${submission.geo?.country}</p>`,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn('Email notification failed:', err.message);
    }
  }
}

/**
 * @openapi
 * /api/dashboard/submissions:
 *   get:
 *     summary: List submissions (authenticated)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: widget_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of submissions
 */
app.get('/api/dashboard/submissions', verifyToken, async (req, res) => {
  let where = ['w.owner_id = $1'];
  let params = [req.user.id];
  let paramIndex = 2;

  if (req.query.widget_id) {
    where.push(`s.widget_id = $${paramIndex++}`);
    params.push(Number(req.query.widget_id));
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const countResult = await pool.query(
    `SELECT COUNT(*) AS n FROM submissions s JOIN widgets w ON s.widget_id = w.id ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0].n);

  const { rows } = await pool.query(
    `SELECT s.*, w.title AS widget_title
     FROM submissions s JOIN widgets w ON s.widget_id = w.id
     ${whereClause} ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  res.json({ total, count: rows.length, offset, limit, submissions: rows });
});

/**
 * @openapi
 * /api/dashboard/stats:
 *   get:
 *     summary: Dashboard stats (authenticated)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Submission statistics
 */
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  const widgetsResult = await pool.query(
    'SELECT COUNT(*) AS n FROM widgets WHERE owner_id = $1',
    [req.user.id]
  );

  const submissionsResult = await pool.query(
    `SELECT COUNT(*) AS n FROM submissions s JOIN widgets w ON s.widget_id = w.id WHERE w.owner_id = $1`,
    [req.user.id]
  );

  const spamResult = await pool.query(
    `SELECT COUNT(*) AS n FROM submissions s JOIN widgets w ON s.widget_id = w.id WHERE w.owner_id = $1 AND s.is_spam = true`,
    [req.user.id]
  );

  const todayResult = await pool.query(
    `SELECT COUNT(*) AS n FROM submissions s JOIN widgets w ON s.widget_id = w.id WHERE w.owner_id = $1 AND s.created_at > now() - interval '24 hours'`,
    [req.user.id]
  );

  const geoResult = await pool.query(
    `SELECT s.geo->>'country' AS country, s.geo->>'city' AS city, COUNT(*) AS count
     FROM submissions s JOIN widgets w ON s.widget_id = w.id
     WHERE w.owner_id = $1 AND s.is_spam = false AND s.geo->>'country' IS NOT NULL
     GROUP BY s.geo->>'country', s.geo->>'city' ORDER BY count DESC LIMIT 10`,
    [req.user.id]
  );

  res.json({
    widgets: Number(widgetsResult.rows[0].n),
    total_submissions: Number(submissionsResult.rows[0].n),
    spam_blocked: Number(spamResult.rows[0].n),
    last_24h: Number(todayResult.rows[0].n),
    top_locations: geoResult.rows,
  });
});

/**
 * @openapi
 * /:
 *   get:
 *     summary: API info
 *     tags: [Info]
 *     responses:
 *       200:
 *         description: API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'potato-widget-platform',
    version: '2.0.0',
    endpoints: [
      '/auth/signup', '/auth/login', '/auth/logout',
      '/api/widgets', '/api/widgets/:id', '/api/widgets/:id/snippet', '/api/widgets/:id/config',
      '/api/submissions', '/api/dashboard/submissions', '/api/dashboard/stats',
      '/widget.js', '/demo', '/docs',
    ],
  });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Info]
 *     responses:
 *       200:
 *         description: Server and database healthy
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

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    cleanupRateLimits(pool).catch(() => {});
    setInterval(() => cleanupRateLimits(pool).catch(() => {}), 5 * 60 * 1000);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Demo page: http://localhost:${PORT}/demo`);
      console.log(`Swagger docs: http://localhost:${PORT}/docs`);
    });
  })
  .catch((err) => {
    console.warn('Warning: Database unavailable — task routes will fail:', err.message);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT} (no database)`);
    });
  });
