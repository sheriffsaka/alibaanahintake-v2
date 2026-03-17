import React, { useContext, useState, useEffect, useCallback } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import Button from '../common/Button';
import { Mail, ArrowLeft, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { sendOTP, checkSession } from '../../services/apiService';
import { supabase } from '../../services/supabaseClient';

const EmailVerification: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { t } = useTranslation();
  const { state, dispatch } = context;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Check if user is already verified when component mounts
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.email?.toLowerCase() === state.formData.email.toLowerCase()) {
        console.log('>>> User already verified on mount:', session.user.email);
        dispatch({ type: 'SET_EMAIL_VERIFIED', payload: true });
        dispatch({ type: 'NEXT_STEP' });
      }
    };
    checkInitialSession();

    // Listen for auth state changes (e.g. if user clicks magic link in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('>>> Auth state changed in EmailVerification:', event, session?.user?.email);
      if (session && session.user.email?.toLowerCase() === state.formData.email.toLowerCase()) {
        console.log('>>> Verification successful via auth state change!');
        dispatch({ type: 'SET_EMAIL_VERIFIED', payload: true });
        dispatch({ type: 'NEXT_STEP' });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [state.formData.email, dispatch]);

  const handleSendOTP = useCallback(async () => {
    setResending(true);
    setError(null);
    try {
      await sendOTP(state.formData.email);
      setCountdown(60); // 60 seconds cooldown
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes('rate limit')) {
        setError("Email rate limit exceeded. Please wait a few minutes or check your inbox for the previous code/link.");
      } else {
        setError(error.message || "Failed to send verification code.");
      }
    } finally {
      setResending(false);
    }
  }, [state.formData.email]);

  useEffect(() => {
    // Automatically send OTP when component mounts
    handleSendOTP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCheckStatus = async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    setError(null);
    try {
      // If manual check, add a small delay to allow Supabase backend to sync
      if (!isAuto) await new Promise(resolve => setTimeout(resolve, 1000));

      const isVerified = await checkSession(state.formData.email);
      if (isVerified) {
        dispatch({ type: 'SET_EMAIL_VERIFIED', payload: true });
        dispatch({ type: 'NEXT_STEP' });
      } else if (!isAuto) {
        setError("We couldn't verify your email yet. Please make sure you clicked the link in the email we sent. If you've already clicked it, wait a few seconds and try again.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') {
        setError("The server is not configured to check verification status automatically. Please set the SUPABASE_SERVICE_ROLE_KEY in settings.");
      } else if (!isAuto) {
        setError(error.message || "Failed to check status.");
      }
    } finally {
      if (!isAuto) setLoading(false);
    }
  };

  useEffect(() => {
    // Poll for status every 5 seconds
    const interval = setInterval(() => {
      handleCheckStatus(true);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.formData.email]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">{t('verifyEmailTitle')}</h2>
        <p className="text-gray-600 mt-2">
          We have sent a verification link to <strong>{state.formData.email}</strong>. 
          Please click the link in your email to proceed. 
          <br/>
          <span className="text-xs text-gray-400 mt-1 block">
            Note: The link will open in a new tab. Once clicked, this page will automatically advance.
          </span>
        </p>
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-700 font-medium">
            Check your inbox (and spam folder) for the verification link.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button 
          type="button" 
          fullWidth 
          onClick={handleCheckStatus}
          loading={loading}
          icon={<CheckCircle className="h-5 w-5" />}
          className="py-4 text-lg shadow-sm hover:shadow-md transition-shadow"
        >
          I&apos;ve Clicked the Verification Link
        </Button>

        <div className="flex justify-between items-center text-sm pt-4">
            <button
              type="button"
              onClick={() => dispatch({ type: 'PREV_STEP' })}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> {t('backButton')}
            </button>

            <button
              type="button"
              onClick={handleSendOTP}
              disabled={countdown > 0 || resending}
              className={`flex items-center gap-1 transition-colors ${countdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
            >
              <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
              {countdown > 0 ? t('resendCountdown', { seconds: countdown.toString() }) : "Resend Link"}
            </button>
          </div>
      </div>
    </div>
  );
};

export default EmailVerification;
