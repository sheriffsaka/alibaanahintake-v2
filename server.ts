import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('>>> Initializing Express app...');
  const app = express();
  app.use(express.json());

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Email route (Lazy load Resend to prevent startup crashes)
  app.post('/api/send-email', async (req, res) => {
    try {
      const { Resend } = await import('resend');
      const resendKey = process.env.VITE_RESEND_API_KEY;
      
      if (!resendKey) {
        console.warn('VITE_RESEND_API_KEY is missing');
        return res.status(200).json({ message: 'Email skipped (no API key)' });
      }

      const resend = new Resend(resendKey);
      const { to, subject, html } = req.body;
      
      await resend.emails.send({
        from: 'noreply@yourdomain.com',
        to,
        subject,
        html
      });
      
      res.json({ message: 'Email sent' });
    } catch (error) {
      console.error('Email error:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('>>> Starting Vite in middleware mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();

      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        if (!fs.existsSync(templatePath)) {
          console.error('>>> index.html NOT FOUND at:', templatePath);
          return res.status(500).send('index.html not found');
        }
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
