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

// --- EMAIL HELPER ---
const sendEmail = async (options: { 
  to: string; 
  subject: string; 
  html: string; 
  fromName?: string;
  fromEmail?: string;
}) => {
  const { to, subject, html, fromName = 'Al-Ibaanah', fromEmail: customFrom } = options;
  
  // 1. Try SMTP if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFromEmail = customFrom || process.env.SMTP_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      console.log(`>>> Sending email via SMTP to ${to}...`);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${smtpFromEmail}>`,
        to,
        subject,
        html,
      });
      console.log('>>> SMTP Email sent:', info.messageId);
      return { success: true, id: info.messageId, method: 'smtp' };
    } catch (smtpError) {
      console.error('>>> SMTP Failed, falling back to Resend if available:', smtpError);
    }
  }

  // 2. Fallback to Resend
  const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const resendFromEmail = customFrom || process.env.VITE_RESEND_FROM_EMAIL || 'noreply@registration.ibaanah.com';

  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      console.log(`>>> Sending email via Resend to ${to}...`);
      const { data, error: resendError } = await resend.emails.send({
        from: `"${fromName}" <${resendFromEmail}>`,
        to,
        subject,
        html,
      });

      if (resendError) throw resendError;
      console.log('>>> Resend Email sent:', data?.id);
      return { success: true, id: data?.id, method: 'resend' };
    } catch (resendError: unknown) {
      const error = resendError as { message?: string; name?: string };
      console.error('>>> Resend Failed:', error);
      throw error;
    }
  }

  throw new Error('No email service (SMTP or Resend) is configured.');
};

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
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('>>> Missing Configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingStudent } = await supabase
      .from('students')
      .select('id, created_at')
      .eq('email', email.toLowerCase())
      .not('status', 'eq', 'archived') // Only block if there's an active (non-archived) registration
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

    console.log(`>>> Attempting to send email to ${email} via unified helper...`);
    try {
      const emailResult = await sendEmail({
        to: email,
        subject: 'Verification Code - Al-Ibaanah Registration',
        fromName: 'Al-Ibaanah Registration',
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">Email Verification</h2>
            <p>As-salamu 'alaykum,</p>
            <p>Your verification code for the Al-Ibaanah slot booking is:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">${otp}</div>
            <p>This code will expire in 15 minutes.</p>
          </div>`
      });
      
      console.log(`>>> Email Success (${emailResult.method}):`, emailResult.id);
      res.json({ 
        message: 'OTP sent successfully', 
        id: emailResult.id,
        method: emailResult.method
      });
    } catch (emailError: unknown) {
      const error = emailError as { message?: string; name?: string };
      console.error('>>> Email Helper Error:', error);
      
      // Handle quota reached specifically for Resend fallback
      if (error.message?.toLowerCase().includes('quota') || error.name === 'rate_limit_exceeded') {
        console.warn(`>>> EMERGENCY OTP LOG (Quota Reached): Verification code for ${email} is ${otp}`);
        return res.status(429).json({ 
          error: 'Daily email sending quota reached', 
          details: 'The system email limit has been reached. For testing, please contact the administrator to retrieve the code from server logs.',
          code: process.env.NODE_ENV !== 'production' ? otp : undefined
        });
      }
      
      throw error;
    }
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
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
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

router.post('/manage/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check if student exists (prefer active ones)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, firstname')
      .eq('email', email.toLowerCase())
      .order('status', { ascending: true }) // 'active' sorts before 'archived' alphabetically? Actually let's use a explicit filter or ordering
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return res.status(404).json({ error: 'No student record found with this email' });

    // 2. Generate and store OTP
    await supabase.from('otp_codes').delete().eq('email', email.toLowerCase());
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { error: dbError } = await supabase.from('otp_codes').insert({ 
      email: email.toLowerCase(), 
      code: otp, 
      expires_at: expiresAt.toISOString() 
    });
    if (dbError) throw dbError;

    // 3. Send email via unified helper
    try {
      const emailResult = await sendEmail({
        to: email,
        subject: 'Manage Booking Verification Code',
        fromName: 'Al-Ibaanah',
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Manage Your Booking</h2>
            <p>Hello ${student.firstname},</p>
            <p>Your verification code to access and update your booking details is:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; margin: 20px 0;">${otp}</div>
            <p>This code will expire in 15 minutes.</p>
          </div>`
      });

      res.json({ message: 'OTP sent', id: emailResult.id, method: emailResult.method });
    } catch (emailError: unknown) {
        const error = emailError as { message?: string };
        console.error('>>> Email Helper Error (Manage OTP):', error);
        if (error.message?.toLowerCase().includes('quota')) {
            console.warn(`>>> EMERGENCY OTP LOG (Quota Reached - Manage): Verification code for ${email} is ${otp}`);
            return res.status(429).json({ 
                error: 'Daily email sending quota reached',
                details: 'Please retrieve the code from the server logs or try again tomorrow.'
            });
        }
        throw error;
    }
  } catch (error: unknown) {
    console.error('Request manage OTP error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/manage/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Verify OTP
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (otpError) throw otpError;
    if (!otpData || otpData.length === 0) return res.status(400).json({ error: 'Invalid or expired verification code' });

    // 2. Fetch student details (prefer active/booked vs archived, then most recent)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, levels(name)')
      .eq('email', email.toLowerCase())
      .order('status', { ascending: false }) // 'checked-in' > 'booked' > 'archived'
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return res.status(404).json({ error: 'No student record found for this account' });
    
    // 3. Cleanup OTP
    await supabase.from('otp_codes').delete().eq('id', otpData[0].id);

    res.json({ student });
  } catch (error: unknown) {
    console.error('Verify manage OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/manage/update-student', async (req, res) => {
  const { studentId, updates } = req.body;
  if (!studentId || !updates) return res.status(400).json({ error: 'Student ID and updates are required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log(`>>> Attempting update for student ID: ${studentId}`, updates);

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentId)
      .select('*, levels(name)');

    if (error) {
      console.error('>>> Supabase update error:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.error('>>> Update failed: No student record matched ID or no data returned');
      // Let's try to see if the record even exists
      const { data: checkData } = await supabase.from('students').select('id, status').eq('id', studentId).maybeSingle();
      console.log(`>>> Check if student exists: ${!!checkData}`, checkData);
      return res.status(404).json({ 
        error: 'Student record not found or update returned no data',
        studentId,
        exists: !!checkData,
        status: checkData?.status
      });
    }

    res.json({ student: data[0] });
  } catch (error: unknown) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student details' });
  }
});

router.post('/manage/delete-student', async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'Student ID is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student record' });
  }
});

router.post('/manage/bulk-delete-students', async (req, res) => {
  const { studentIds } = req.body;
  if (!studentIds || !Array.isArray(studentIds)) return res.status(400).json({ error: 'Student IDs array is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('students')
      .delete()
      .in('id', studentIds);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Bulk delete students error:', error);
    res.status(500).json({ error: 'Failed to delete student records' });
  }
});

router.post('/manage/bulk-delete-slots', async (req, res) => {
  const { slotIds } = req.body;
  if (!slotIds || !Array.isArray(slotIds)) return res.status(400).json({ error: 'Slot IDs array is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('appointment_slots')
      .delete()
      .in('id', slotIds);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Bulk delete slots error:', error);
    res.status(500).json({ error: 'Failed to delete schedule slots' });
  }
});

router.post('/manage/renew-session', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('>>> Proceeding with session renewal...');

    // 1. Archive all current active students
    const { error: archiveError } = await supabase
        .from('students')
        .update({ status: 'archived' })
        .not('status', 'eq', 'archived');

    if (archiveError) {
        console.error('>>> Archive Error:', archiveError);
        throw archiveError;
    }

    // 2. Reset booked counts for all slots to zero
    // Satisfy PostgREST bulk-update safety by adding a wildcard filter on capacity
    const { error: resetError } = await supabase
        .from('appointment_slots')
        .update({ booked: 0 })
        .gt('capacity', 0);

    if (resetError) {
        console.error('>>> Slot Reset Error:', resetError);
        throw resetError;
    }

    console.log('>>> Session renewed successfully');
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Renew session error:', error);
    res.status(500).json({ error: 'Failed to renew session' });
  }
});

router.post('/enroll/register', async (req, res) => {
  const { slotId, studentData } = req.body;
  if (!slotId || !studentData) return res.status(400).json({ error: 'Slot ID and student data are required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Submit registration via RPC
    const { data: registrationResult, error: registrationError } = await supabase.rpc('submit_student_registration', {
      slot_id: slotId,
      student_data: studentData
    });

    if (registrationError) {
      console.error(">>> Registration RPC Error:", registrationError);
      return res.status(400).json({ error: registrationError.message || "Failed to submit registration. The slot may have been filled." });
    }

    // RPC might return an array or a single object. Ensure we have an object.
    const newStudentRaw = Array.isArray(registrationResult) ? registrationResult[0] : registrationResult;
    
    if (!newStudentRaw) {
        return res.status(500).json({ error: "Registration failed to return student data." });
    }

    // 2. Fetch full student details with joined levels for the slip/email
    const { data: newStudent } = await supabase
      .from('students')
      .select('*, levels(name)')
      .eq('id', newStudentRaw.id)
      .single();

    if (!newStudent) {
        return res.status(500).json({ error: "Failed to retrieve student record after registration." });
    }

    // 3. Fetch slot details for email
    const { data: slot } = await supabase
      .from('appointment_slots')
      .select('*, levels(name)')
      .eq('id', slotId)
      .single();

    // 4. Send confirmation email
    if (newStudent.email) {
      try {
        const { data: settingsData } = await supabase.from('notification_settings').select('settings').single();
        const settings = settingsData?.settings;
        
        const studentLang = newStudent.language || 'en';
        const langSettings = (settings && settings[studentLang]) || (settings && settings['en']);
        
        if (langSettings && langSettings.confirmation.enabled) {
          let subject = langSettings.confirmation.subject;
          let body = langSettings.confirmation.body;

          const fullName = `${newStudent.firstname} ${newStudent.othername ? newStudent.othername + ' ' : ''}${newStudent.surname}`;
          subject = subject.replace(/{{studentName}}/g, fullName);
          body = body.replace(/{{studentName}}/g, fullName);
          body = body.replace('{{level}}', newStudent.levels?.name || slot?.levels?.name || '');
          body = body.replace('{{appointmentDate}}', newStudent.intake_date || slot?.date || '');
          body = body.replace('{{appointmentTime}}', slot ? `${slot.start_time} - ${slot.end_time}` : '');
          body = body.replace('{{registrationCode}}', newStudent.registration_code);
          
          // Add all details as requested
          const detailsTable = `
            <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
              <p><strong>Registration Details:</strong></p>
              <ul>
                <li><strong>Registration ID:</strong> ${newStudent.registration_code}</li>
                <li><strong>Full Name:</strong> ${fullName}</li>
                <li><strong>Gender:</strong> ${newStudent.gender}</li>
                <li><strong>Email:</strong> ${newStudent.email}</li>
                <li><strong>WhatsApp:</strong> ${newStudent.whatsapp}</li>
                <li><strong>Level:</strong> ${newStudent.levels?.name || 'N/A'}</li>
                <li><strong>Intake Date:</strong> ${newStudent.intake_date || 'N/A'}</li>
                <li><strong>Intake Time:</strong> ${slot ? `${slot.start_time} - ${slot.end_time}` : 'N/A'}</li>
              </ul>
            </div>
          `;
          body += detailsTable;

          await sendEmail({
            to: newStudent.email,
            subject: subject,
            fromName: 'Al-Ibaanah Registration',
            html: body.replace(/\n/g, '<br>')
          });
          console.log(`>>> Confirmation email sent to ${newStudent.email}`);
        }
      } catch (emailError) {
        console.error(">>> Registration confirmation email failed:", emailError);
      }
    }

    res.json({ student: newStudent });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

router.get('/auth/is-confirmed', async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
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
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
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

router.post('/manage/resend-confirmation', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ error: 'Student ID is required' });

        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(500).json({ error: 'Server configuration error (Supabase)' });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch student info
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('*, appointment_slots(*), levels(name)')
            .eq('id', studentId)
            .single();

        if (studentError || !student) throw new Error('Student not found');
        if (!student.email) throw new Error('Student has no email');

        // 2. Fetch notification settings
        const { data: settingsData } = await supabase.from('notification_settings').select('settings').single();
        const settings = settingsData?.settings;
        const lang = student.language || 'en';
        const langSettings = settings?.[lang] || settings?.['en'];

        if (!langSettings || !langSettings.confirmation.enabled) {
            throw new Error('Confirmation emails are disabled in settings');
        }

        // 3. Prepare email
        let subject = langSettings.confirmation.subject;
        let body = langSettings.confirmation.body;
        
        subject = subject.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
        body = body.replace('{{studentName}}', `${student.firstname} ${student.surname}`);
        body = body.replace('{{level}}', student.levels?.name || '');
        body = body.replace('{{appointmentDate}}', student.appointment_slots.date);
        body = body.replace('{{appointmentTime}}', `${student.appointment_slots.start_time} - ${student.appointment_slots.end_time}`);
        body = body.replace('{{registrationCode}}', student.registration_code);

        // 4. Send
        const result = await sendEmail({
            to: student.email,
            subject,
            fromName: 'Al-Ibaanah Registration',
            html: body.replace(/\n/g, '<br>')
        });

        res.json({ success: true, message: 'Confirmation email resent', id: result.id });
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('>>> Resend Confirmation Error:', err);
        res.status(500).json({ error: err.message || 'Failed to resend confirmation' });
    }
});

router.post('/cron/reminders', async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Missing configuration' });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch notification settings
    const { data: settingsData } = await supabase.from('notification_settings').select('settings').single();
    if (!settingsData) return res.status(404).json({ error: 'Settings not found' });
    const settings = settingsData.settings;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // 1. Fetch students for 24h reminders
    const { data: students24h, error: error24h } = await supabase
      .from('students')
      .select('*, appointment_slots!inner(*), levels(name)')
      .eq('appointment_slots.date', tomorrowStr)
      .eq('status', 'booked')
      .eq('reminded_24h', false);

    if (error24h) console.error('>>> Error fetching 24h reminders:', error24h);

    if (students24h && students24h.length > 0) {
      console.log(`>>> Processing ${students24h.length} 24h reminders...`);
      for (const student of students24h) {
        try {
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

            await sendEmail({
              to: student.email,
              subject,
              fromName: 'Al-Ibaanah Booking',
              html: body.replace(/\n/g, '<br>')
            });

            // Mark as reminded
            await supabase.from('students').update({ reminded_24h: true }).eq('id', student.id);
          }
        } catch (err) {
          console.error(`>>> Failed to send 24h reminder to ${student.email}:`, err);
        }
      }
    }

    // 2. Fetch students for Day-of reminders
    const { data: studentsDayOf, error: errorDayOf } = await supabase
      .from('students')
      .select('*, appointment_slots!inner(*), levels(name)')
      .eq('appointment_slots.date', todayStr)
      .eq('status', 'booked')
      .eq('reminded_day_of', false);

    if (errorDayOf) console.error('>>> Error fetching Day-of reminders:', errorDayOf);

    if (studentsDayOf && studentsDayOf.length > 0) {
      console.log(`>>> Processing ${studentsDayOf.length} Day-of reminders...`);
      for (const student of studentsDayOf) {
        try {
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

            await sendEmail({
              to: student.email,
              subject,
              fromName: 'Al-Ibaanah Booking',
              html: body.replace(/\n/g, '<br>')
            });

            // Mark as reminded
            await supabase.from('students').update({ reminded_day_of: true }).eq('id', student.id);
          }
        } catch (err) {
          console.error(`>>> Failed to send Day-of reminder to ${student.email}:`, err);
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
    const { to, subject, html, fromName } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'To, Subject and HTML are required' });
    }

    console.log(`>>> Sending email to ${to} via unified helper...`);
    const emailResult = await sendEmail({ 
      to, 
      subject, 
      html,
      fromName: fromName || 'Al-Ibaanah Registration'
    });

    console.log(`>>> Email sent successfully (${emailResult.method}):`, emailResult.id);
    res.json({ message: 'Email sent', id: emailResult.id, method: emailResult.method });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error instanceof Error ? error.message : String(error) });
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
