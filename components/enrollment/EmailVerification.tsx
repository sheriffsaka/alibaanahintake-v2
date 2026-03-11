import React, { useContext, useState, useEffect, useCallback } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import Button from '../common/Button';
import Input from '../common/Input';
import { Mail, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { sendOTP, verifyOTP } from '../../services/apiService';

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
      await sendOTP(state.formData.email);
      setCountdown(60); // 60 seconds cooldown
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to send verification code.");
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
    if (!otp) return;
    
    setLoading(true);
    setError(null);
    try {
      await verifyOTP(state.formData.email, otp);
      dispatch({ type: 'SET_EMAIL_VERIFIED', payload: true });
      dispatch({ type: 'NEXT_STEP' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Verification error:', error);
      setError(error.message || t('errorInvalidCode'));
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

      <form onSubmit={handleVerify} className="space-y-4">
        <Input
          label={t('verificationCodeLabel')}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter 6-digit code"
          icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
          error={error || undefined}
          required
        />

        <div className="flex flex-col gap-3">
          <Button type="submit" fullWidth loading={loading}>
            {t('verifyButton')}
          </Button>
          
          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => dispatch({ type: 'PREV_STEP' })}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> {t('backButton')}
            </button>

            <button
              type="button"
              onClick={handleSendOTP}
              disabled={countdown > 0 || resending}
              className={`flex items-center gap-1 ${countdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
            >
              <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
              {countdown > 0 ? t('resendCountdown', { seconds: countdown.toString() }) : t('resendCodeButton')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmailVerification;
