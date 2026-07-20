const express = require('express');
const app = express();
app.use(express.json());

const pkg = require('./package.json');

app.get('/', (req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    endpoints: ['/', '/health'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
