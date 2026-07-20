const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiDoc = require('./openapi.json');
const app = express();
app.use(express.json());

const pkg = require('./package.json');

let nextId = 4;
const tasks = [
  { id: 1, title: 'Install tools', done: true },
  { id: 2, title: 'Build REST API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));

app.get('/', (req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    endpoints: ['/', '/health', '/tasks', '/tasks/:id', '/stats', '/reset'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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
  res.json(result);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = { id: nextId++, title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

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

app.delete('/tasks/:id', (req, res) => {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Task not found' });
  tasks.splice(index, 1);
  res.status(204).end();
});

app.get('/stats', (req, res) => {
  res.json({
    total: tasks.length,
    done: tasks.filter((t) => t.done).length,
    pending: tasks.filter((t) => !t.done).length,
  });
});

const defaultTasks = [
  { id: 1, title: 'Install tools', done: true },
  { id: 2, title: 'Build REST API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

app.post('/reset', (req, res) => {
  tasks.length = 0;
  tasks.push(...defaultTasks.map((t) => ({ ...t })));
  nextId = 4;
  res.json({ message: 'Tasks reset to defaults', tasks });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
