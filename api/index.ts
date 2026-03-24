import express from 'express';

const app = express();

app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Simple Express debug route works',
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    time: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
