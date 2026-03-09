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

  // Cron route for reminders
  app.post('/api/cron/reminders', async (req, res) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { Resend } = await import('resend');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const resendKey = process.env.VITE_RESEND_API_KEY;
      const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@yourdomain.com';

      if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
        return res.status(500).json({ error: 'Missing configuration' });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const resend = new Resend(resendKey);

      // 1. Get notification settings
      const { data: settingsData } = await supabase
        .from('notification_settings')
        .select('settings')
        .single();
      
      if (!settingsData) return res.status(404).json({ error: 'Settings not found' });
      const settings = settingsData.settings;

      const results = {
        reminder24h: { sent: 0, skipped: 0, errors: 0 },
        reminderDayOf: { sent: 0, skipped: 0, errors: 0 }
      };

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Helper to send reminder
      const sendReminder = async (student: any, template: any, type: '24h' | 'dayOf') => {
        let body = template.body;
        body = body.replace(/{{studentName}}/g, `${student.firstname} ${student.surname}`);
        body = body.replace(/{{level}}/g, student.levels?.name || 'Assigned Level');
        body = body.replace(/{{appointmentDate}}/g, student.appointment_slots?.date);
        body = body.replace(/{{appointmentTime}}/g, `${student.appointment_slots?.start_time} - ${student.appointment_slots?.end_time}`);
        body = body.replace(/{{registrationCode}}/g, student.registration_code);

        try {
          await resend.emails.send({
            from: fromEmail,
            to: student.email,
            subject: template.subject,
            html: body.replace(/\n/g, '<br>')
          });

          // Mark as sent
          const updateField = type === '24h' ? 'reminder_24h_sent' : 'reminder_day_of_sent';
          await supabase
            .from('students')
            .update({ [updateField]: true })
            .eq('id', student.id);
          
          return true;
        } catch (err) {
          console.error(`Failed to send ${type} reminder to ${student.email}:`, err);
          return false;
        }
      };

      // 2. Process 24h reminders (for tomorrow)
      if (settings.reminder24h?.enabled) {
        const { data: students24h } = await supabase
          .from('students')
          .select('*, levels(name), appointment_slots(date, start_time, end_time)')
          .eq('intake_date', tomorrowStr)
          .eq('reminder_24h_sent', false);
        
        if (students24h) {
          for (const student of students24h) {
            const success = await sendReminder(student, settings.reminder24h, '24h');
            if (success) results.reminder24h.sent++;
            else results.reminder24h.errors++;
          }
        }
      } else {
        results.reminder24h.skipped = -1; // Disabled in settings
      }

      // 3. Process Day-of reminders (for today)
      if (settings.reminderDayOf?.enabled) {
        const { data: studentsDayOf } = await supabase
          .from('students')
          .select('*, levels(name), appointment_slots(date, start_time, end_time)')
          .eq('intake_date', todayStr)
          .eq('reminder_day_of_sent', false);
        
        if (studentsDayOf) {
          for (const student of studentsDayOf) {
            const success = await sendReminder(student, settings.reminderDayOf, 'dayOf');
            if (success) results.reminderDayOf.sent++;
            else results.reminderDayOf.errors++;
          }
        }
      } else {
        results.reminderDayOf.skipped = -1; // Disabled in settings
      }

      res.json({ message: 'Cron job completed', results });
    } catch (error) {
      console.error('Cron error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
      const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@yourdomain.com';
      
      await resend.emails.send({
        from: fromEmail,
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

    app.get('(.*)', async (req, res, next) => {
      const url = req.originalUrl;
      console.log('>>> Dev catch-all hit for URL:', url);
      // Only handle GET requests that are not API calls
      if (req.method !== 'GET' || url.startsWith('/api')) {
        return next();
      }

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
    app.get('(.*)', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error('>>> index.html NOT FOUND in dist at:', indexPath);
        res.status(404).send('Application not found. Please try again later.');
      }
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('>>> Global Server Error:', err);
    res.status(500).send('Internal Server Error');
  });

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
