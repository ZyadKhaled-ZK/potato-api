require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title)`);

  const { rows: taskRows } = await pool.query('SELECT COUNT(*) AS n FROM tasks');
  if (Number(taskRows[0].n) === 0) {
    await pool.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2), ($3, $4), ($5, $6)',
      ['Install tools', true, 'Build REST API', false, 'Write tests', false]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS widgets (
      id SERIAL PRIMARY KEY,
      owner_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'popover' CHECK (type IN ('popover', 'signup', 'cta')),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      fields JSONB NOT NULL DEFAULT '[]',
      targeting JSONB NOT NULL DEFAULT '{}',
      button_text TEXT DEFAULT 'Submit',
      theme JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_widgets_owner ON widgets(owner_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      widget_id INTEGER NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      geo JSONB DEFAULT '{}',
      is_spam BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_widget ON submissions(widget_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      widget_id INTEGER NOT NULL,
      window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (ip, widget_id, window_start)
    )
  `);
}

module.exports = { pool, init };
