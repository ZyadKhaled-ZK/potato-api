const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tasks.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title)`);

const count = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seed = db.transaction((rows) => {
    for (const row of rows) insert.run(row.title, row.done);
  });
  seed([
    { title: 'Install tools', done: 1 },
    { title: 'Build REST API', done: 0 },
    { title: 'Write tests', done: 0 },
  ]);
}

module.exports = db;
