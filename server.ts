import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

console.log('>>> server.ts LOADED');

// Log environment variable presence (NOT values) for debugging on Vercel
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_RESEND_API_KEY',
  'VITE_RESEND_FROM_EMAIL'
];
console.log('>>> [ENV CHECK] Checking required environment variables:');
requiredEnvVars.forEach(key => {
  console.log(`>>> [ENV CHECK] ${key}: ${process.env[key] ? 'PRESENT' : 'MISSING'}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS for all requests
app.use(cors());

// VERY TOP LEVEL LOGGER - Log every single request before anything else
app.use((req, res, next) => {
  console.log(`>>> [REQUEST] ${new Date().toISOString()} - ${req.method} ${req.url} (Host: ${req.headers.host})`);
  next();
});

app.use(express.json());

// Health check route
app.get('/api/health', (req, res) => {
  console.log('>>> Health check hit');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Test route for debugging
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    time: new Date().toISOString(),
    config: {
      supabaseUrl: !!process.env.VITE_SUPABASE_URL,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      resendKey: !!process.env.VITE_RESEND_API_KEY,
      fromEmail: !!process.env.VITE_RESEND_FROM_EMAIL,
      cronSecret: !!process.env.CRON_SECRET
    }
  });
});

// --- AUTH ROUTES ---

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  console.log(`>>> [API] Generating custom OTP for: ${email}`);
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { Resend } = await import('resend');

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.VITE_RESEND_API_KEY;
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';
    console.log(`>>> [API] Using fromEmail: ${fromEmail}`);

    if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!resendKey) missing.push('VITE_RESEND_API_KEY');
      
      console.error('>>> [API] Missing config for OTP:', missing.join(', '));
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: `Missing environment variables: ${missing.join(', ')}. Please check your deployment settings.` 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    // 1. Check if the student is already FULLY registered
    const { data: existingStudent, error: studentCheckError } = await supabase
      .from('students')
      .select('id, registration_code')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (studentCheckError) {
      console.error('>>> [API] Error checking existing student:', studentCheckError);
    }

    if (existingStudent) {
      return res.status(400).json({ 
        error: 'This email is already registered. Please check your inbox for your admission slip or contact administration if you need to reschedule.' 
      });
    }

    // Cleanup previous OTPs
    await supabase.from('otp_codes').delete().eq('email', email.toLowerCase());

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert({ 
        email: email.toLowerCase(), 
        code: otp, 
        expires_at: expiresAt.toISOString() 
      });

    if (dbError) throw dbError;

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verification Code - Al-Ibaanah Registration',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">Email Verification</h2>
          <p>As-salamu 'alaykum,</p>
          <p>Your verification code for the Al-Ibaanah slot booking is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">
            Al-Ibaanah Arabic Center, Cairo, Egypt
          </p>
        </div>
      `
    });

    console.log(`>>> [API] OTP sent to ${email}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('>>> [API] Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  console.log(`>>> [API] Verifying OTP for: ${email}`);

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    await supabase.from('otp_codes').delete().eq('id', data[0].id);
    res.json({ message: 'Verification successful' });
  } catch (error) {
    console.error('>>> [API] Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/auth/is-confirmed', async (req, res) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let page = 1;
    let found = false;
    let confirmed = false;

    while (page <= 5) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
      if (error) throw error;
      if (!users || users.length === 0) break;

      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        found = true;
        confirmed = !!user.email_confirmed_at || !!user.last_sign_in_at || !!user.confirmed_at;
        break;
      }
      page++;
    }
    res.json({ confirmed, found });
  } catch (error) {
    console.error('>>> [API] Check confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/is-verified', async (req, res) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('pre_registrations')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    res.json({ verified: !!data });
  } catch (error) {
    console.error('>>> [API] Check verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';
    console.log(`>>> [CRON] Using fromEmail: ${fromEmail}`);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendReminder = async (student: any, template: any, type: '24h' | 'dayOf') => {
      let body = template.body as string;
      body = body.replace(/{{studentName}}/g, `${student.firstname} ${student.surname}`);
      body = body.replace(/{{level}}/g, student.levels?.name || 'Assigned Level');
      body = body.replace(/{{appointmentDate}}/g, student.appointment_slots?.date);
      body = body.replace(/{{appointmentTime}}/g, `${student.appointment_slots?.start_time} - ${student.appointment_slots?.end_time}`);
      body = body.replace(/{{registrationCode}}/g, student.registration_code as string);

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
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';
    console.log(`>>> [EMAIL] Using fromEmail: ${fromEmail}`);
    
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

// JSON 404 for unmatched API routes - MUST be after all API routes
app.all('/api/*', (req, res) => {
  console.warn(`>>> 404 API Route Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'API route not found', 
    method: req.method, 
    path: req.url,
    originalUrl: req.originalUrl
  });
});

// --- Vite / Static Setup ---

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
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  
  // SPA fallback - match everything that isn't an API route
  app.get('*', (req, res, next) => {
    // Skip if it looks like an API route (should have been caught by the API 404 handler above if not matched)
    if (req.url.startsWith('/api')) {
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

// Global Error Handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('>>> Global Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export for Vercel
export default app;

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running at http://0.0.0.0:${PORT}`);
  });
}
