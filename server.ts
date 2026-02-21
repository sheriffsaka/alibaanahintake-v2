import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function createServer() {
  const app = express();
  app.use(express.json());

  // Create Vite server in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
  }

  // API routes will be added here

import { Resend } from 'resend';

const resend = new Resend(process.env.VITE_RESEND_API_KEY);

app.post('/api/send-email', async (req, res) => {
    const { to, subject, html } = req.body;
    try {
        await resend.emails.send({ from: 'noreply@yourdomain.com', to, subject, html });
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send email' });
    }
});

  // Handle SPA routing
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
        return next(); // Skip API requests
    }
    if (process.env.NODE_ENV !== 'production') {
        // In dev, Vite handles this. This is a fallback.
        res.status(200).set({ 'Content-Type': 'text/html' }).send('');
    } else {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    }
  });

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

createServer();
