import express from 'express';
import app from './api/index.ts';

const PORT = 3000;

// --- Vite / Static Setup ---

async function setupStatic() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    console.log('>>> Starting Vite in middleware mode...');
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('>>> Vite middleware added');
    } catch (err) {
      console.error('>>> Failed to start Vite:', err);
    }
  } else if (!process.env.VERCEL) {
    // Only serve static files if NOT on Vercel (Vercel handles this via rewrites)
    const path = await import('path');
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const distPath = path.resolve(__dirname, 'dist');
    
    app.use(express.static(distPath));
    
    // SPA fallback - match everything that isn't an API route
    app.get('*', (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not found.');
      }
    });
  }
}

// Initialize static setup
setupStatic();

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running at http://0.0.0.0:${PORT}`);
  });
}

export default app;
