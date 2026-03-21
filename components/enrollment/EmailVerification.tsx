import React, { useContext, useState, useEffect, useCallback } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import Button from '../common/Button';
import { Mail, ArrowLeft, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { sendOTP, verifyOTP, savePreRegistration } from '../../services/apiService';

const EmailVerification: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { t } = useTranslation();
  const { state, dispatch } = context;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendOTP = useCallback(async () => {
    setResending(true);
    setError(null);
    try {
      // Diagnostic check: Verify API reachability
      console.log('>>> [Diagnostic] Checking API health...');
      const healthCheck = await fetch(`${window.location.origin}/api/health`).catch((err) => {
        console.error('>>> [Diagnostic] Health check fetch error:', err);
        return null;
      });
      
      if (!healthCheck || !healthCheck.ok) {
        console.error('>>> [Diagnostic] API Health Check Failed:', healthCheck?.status);
        const text = healthCheck ? await healthCheck.text().catch(() => 'No body') : 'Network Error';
        throw new Error(`API is unreachable (Status: ${healthCheck?.status || 'Network Error'}). Content: ${text.substring(0, 50)}...`);
      }
      console.log('>>> [Diagnostic] API Health Check Passed');

      await sendOTP(state.formData.email);
      setCountdown(60); // 60 seconds cooldown
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes('rate limit')) {
        setError("Email rate limit exceeded. Please wait a few minutes or check your inbox for the previous code.");
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyOTP(state.formData.email, otp);
      
      // Save pre-registration data as requested
      await savePreRegistration(state.formData);

      dispatch({ type: 'SET_EMAIL_VERIFIED', payload: true });
      dispatch({ type: 'NEXT_STEP' });
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Invalid or expired verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">{t('verifyEmailTitle')}</h2>
        <p className="text-gray-600 mt-2">
          {t('verifyEmailDescription', { email: state.formData.email })}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
            {t('verificationCodeLabel')}
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder={t('otpPlaceholder')}
            className="block w-full px-4 py-4 text-center text-3xl tracking-[1em] font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button 
          type="submit" 
          fullWidth 
          loading={loading}
          icon={<ShieldCheck className="h-5 w-5" />}
          className="py-4 text-lg shadow-sm hover:shadow-md transition-shadow"
        >
          {t('verifyButton')}
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
            {countdown > 0 ? t('resendCountdown', { seconds: countdown.toString() }) : t('resendCodeButton')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailVerification;
