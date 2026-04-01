import express from 'express';
import cors from 'cors';

const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

// --- LOGGING MIDDLEWARE ---
app.use((req, res, next) => {
  console.log(`>>> [API REQUEST] ${req.method} ${req.url} (Original: ${req.originalUrl})`);
  next();
});

// --- API ROUTES ---

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.get('/debug', (req, res) => {
  res.json({
    message: 'Express debug route in api/index.ts works (v9)',
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    time: new Date().toISOString()
  });
});

router.get('/test', (req, res) => {
  const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
  res.json({ 
    message: 'API Configuration Test', 
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    time: new Date().toISOString(),
    config: {
      supabaseUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      supabaseServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
      resendKey: !!resendKey,
      resendKeyPrefix: resendKey ? resendKey.substring(0, 7) : 'none',
      fromEmail: !!process.env.VITE_RESEND_FROM_EMAIL,
      fromEmailValue: process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com'
    }
  });
});

router.post('/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { Resend } = await import('resend');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';

    if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
      console.error('>>> Missing Config:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey, 
        hasResend: !!resendKey 
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    const { data: existingStudent } = await supabase
      .from('students')
      .select('id, created_at')
      .eq('email', email.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingStudent) {
      const lastRegistrationDate = new Date(existingStudent.created_at);
      const sixWeeksInMs = 6 * 7 * 24 * 60 * 60 * 1000;
      const timeSinceLastRegistration = Date.now() - lastRegistrationDate.getTime();

      if (timeSinceLastRegistration < sixWeeksInMs) {
        const weeksLeft = Math.ceil((sixWeeksInMs - timeSinceLastRegistration) / (7 * 24 * 60 * 60 * 1000));
        return res.status(400).json({ 
          error: `You have already registered recently. You can register again in ${weeksLeft} week(s).` 
        });
      }
    }

    await supabase.from('otp_codes').delete().eq('email', email.toLowerCase());
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { error: dbError } = await supabase.from('otp_codes').insert({ email: email.toLowerCase(), code: otp, expires_at: expiresAt.toISOString() });
    if (dbError) throw dbError;

    console.log(`>>> Attempting to send email to ${email} via Resend...`);
    const formattedFrom = `Al-Ibaanah Registration <${fromEmail}>`;
    const { data, error: resendError } = await resend.emails.send({
      from: formattedFrom,
      to: email,
      subject: 'Verification Code - Al-Ibaanah Registration',
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">Email Verification</h2>
          <p>As-salamu 'alaykum,</p>
          <p>Your verification code for the Al-Ibaanah slot booking is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">${otp}</div>
          <p>This code will expire in 15 minutes.</p>
        </div>`
    });

    if (resendError) {
      console.error('>>> Resend API Error:', resendError);
      throw new Error(resendError.message || 'Resend failed to send email');
    }

    console.log('>>> Resend Success:', data);
    res.json({ 
      message: 'OTP sent successfully', 
      id: data?.id
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('Send OTP error:', error);
    res.status(500).json({ 
      error: 'Failed to send verification code', 
      details: errorMessage,
      type: errorName
    });
  }
});

router.post('/auth/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.from('otp_codes').select('*').eq('email', email.toLowerCase()).eq('code', code).gt('expires_at', new Date().toISOString()).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return res.status(400).json({ error: 'Invalid or expired verification code' });

    await supabase.from('otp_codes').delete().eq('id', data[0].id);
    res.json({ message: 'Verification successful' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      details: errorMessage
    });
  }
});

router.get('/auth/is-confirmed', async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let page = 1;
    let found = false;
    let confirmed = false;

    while (page <= 5) {
      const response = await supabase.auth.admin.listUsers({ page, perPage: 50 });
      const users = response.data?.users || [];
      if (response.error) throw response.error;
      if (users.length === 0) break;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        found = true;
        confirmed = !!user.email_confirmed_at || !!user.last_sign_in_at || !!user.confirmed_at;
        break;
      }
      page++;
    }
    res.json({ confirmed, found });
  } catch (error) {
    console.error('Check confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/auth/is-verified', async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.from('pre_registrations').select('email').eq('email', email.toLowerCase()).maybeSingle();
    if (error) throw error;
    res.json({ verified: !!data });
  } catch (error) {
    console.error('Check verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/cron/reminders', async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { Resend } = await import('resend');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';

    if (!supabaseUrl || !supabaseServiceKey || !resendKey) return res.status(500).json({ error: 'Missing configuration' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    // Fetch notification settings
    const { data: settingsData } = await supabase.from('notification_settings').select('settings').single();
    if (!settingsData) return res.status(404).json({ error: 'Settings not found' });
    const settings = settingsData.settings;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // 1. Fetch students for 24h reminders
    const { data: students24h } = await supabase
      .from('students')
      .select('*, appointment_slots(*), levels(name)')
      .eq('appointment_slots.date', tomorrowStr);

    if (students24h) {
      for (const student of students24h) {
        const lang = student.language || 'en';
        const langSettings = settings[lang] || settings['en'];
        if (langSettings && langSettings.reminder24h.enabled) {
          let subject = langSettings.reminder24h.subject;
          let body = langSettings.reminder24h.body;
          
          subject = subject.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
          body = body.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
          body = body.replace('{{level}}', student.levels?.name || '');
          body = body.replace('{{appointmentDate}}', student.appointment_slots.date);
          body = body.replace('{{appointmentTime}}', `${student.appointment_slots.start_time} - ${student.appointment_slots.end_time}`);
          body = body.replace('{{registrationCode}}', student.registration_code);

          await resend.emails.send({
            from: `Al-Ibaanah Booking <${fromEmail}>`,
            to: student.email,
            subject,
            html: body.replace(/\n/g, '<br>')
          });
        }
      }
    }

    // 2. Fetch students for Day-of reminders
    const { data: studentsDayOf } = await supabase
      .from('students')
      .select('*, appointment_slots(*), levels(name)')
      .eq('appointment_slots.date', todayStr);

    if (studentsDayOf) {
      for (const student of studentsDayOf) {
        const lang = student.language || 'en';
        const langSettings = settings[lang] || settings['en'];
        if (langSettings && langSettings.reminderDayOf.enabled) {
          let subject = langSettings.reminderDayOf.subject;
          let body = langSettings.reminderDayOf.body;
          
          subject = subject.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
          body = body.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
          body = body.replace('{{level}}', student.levels?.name || '');
          body = body.replace('{{appointmentDate}}', student.appointment_slots.date);
          body = body.replace('{{appointmentTime}}', `${student.appointment_slots.start_time} - ${student.appointment_slots.end_time}`);
          body = body.replace('{{registrationCode}}', student.registration_code);

          await resend.emails.send({
            from: `Al-Ibaanah Booking <${fromEmail}>`,
            to: student.email,
            subject,
            html: body.replace(/\n/g, '<br>')
          });
        }
      }
    }

    res.json({ success: true, message: 'Reminders processed' });
  } catch (error) {
    console.error('Cron error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/send-email', async (req, res) => {
  try {
    const { Resend } = await import('resend');
    const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
    const fromEmail = process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';

    if (!resendKey) {
      console.warn('>>> Email skipped: No Resend API key found');
      return res.status(200).json({ message: 'Email skipped (no API key)' });
    }

    const resend = new Resend(resendKey);
    const { to, subject, html } = req.body;
    const formattedFrom = `Al-Ibaanah Registration <${fromEmail}>`;
    
    console.log(`>>> Sending email to ${to}...`);
    const { data, error: resendError } = await resend.emails.send({ 
      from: formattedFrom, 
      to, 
      subject, 
      html 
    });

    if (resendError) {
      console.error('>>> Resend Email Error:', resendError);
      return res.status(500).json({ error: resendError.message });
    }

    console.log('>>> Email sent successfully:', data?.id);
    res.json({ message: 'Email sent', id: data?.id });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Catch-all 404 handler for the router
// This only catches requests that start with the mount point (e.g., /api)
router.all('*', (req, res) => {
  console.warn(`>>> 404 API Route Not Found: ${req.method} ${req.url} (Original: ${req.originalUrl})`);
  res.status(404).json({ 
    error: 'API route not found', 
    method: req.method, 
    path: req.url,
    originalUrl: req.originalUrl,
    message: 'The request reached the API router but did not match any defined routes.'
  });
});

// Mount the router at /api
app.use('/api', router);

// ONLY mount at root for Vercel if the rewrite strips /api
// In local/preview environments, we mount at /api only to avoid catching static traffic
if (process.env.VERCEL) {
  app.use('/', router);
}

export default app;
