const express = require('express');
const app = express();
app.use(express.json());

const pkg = require('./package.json');

let nextId = 4;
const tasks = [
  { id: 1, title: 'Install tools', done: true },
  { id: 2, title: 'Build REST API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

app.get('/', (req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    endpoints: ['/', '/health', '/tasks', '/tasks/:id'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tasks', (req, res) => {
  res.json(tasks);
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

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
