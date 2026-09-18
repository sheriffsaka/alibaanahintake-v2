import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle2, ArrowLeft, X } from 'lucide-react';
import { requestAdminPasswordReset, confirmAdminPasswordReset } from '../services/apiService';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot / Reset Password Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const navigate = useNavigate();
  const { login, user, loading: authLoading } = useAuth();

  React.useEffect(() => {
    if (!authLoading && user) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Both email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const loggedUser = await login(trimmedEmail, password);
      if (loggedUser) {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      const rawMessage = errorObj?.message || '';
      if (rawMessage.toLowerCase().includes('invalid login credentials') || rawMessage.toLowerCase().includes('invalid credentials')) {
        setError('Invalid email or password. If you forgot or need to set your password, click "Forgot / Set Password" below.');
      } else {
        setError(rawMessage || 'An unknown authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetModal = () => {
    setResetEmail(email.trim().toLowerCase());
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
    setResetStep('request');
    setIsResetModalOpen(true);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError('Please enter your administrator email address.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await requestAdminPasswordReset(cleanEmail);
      setResetSuccess(res.message || 'Verification code sent to your email.');
      setResetStep('confirm');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setResetError(errorObj?.message || 'Failed to send reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetCode.trim()) {
      setResetError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await confirmAdminPasswordReset(resetEmail, resetCode, newPassword);
      setIsResetModalOpen(false);
      setEmail(resetEmail);
      setPassword(newPassword);
      setSuccessMessage(res.message || 'Password updated successfully! You can now log in.');
      setError('');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setResetError(errorObj?.message || 'Failed to update password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Portal Login</h2>
          <p className="text-sm text-gray-500 mt-1">Sign in with your administrative credentials</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-start space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="h-4 w-4 text-gray-400" />}
            placeholder="admin@alibaanah.com"
            required
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4 text-gray-400" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handleOpenResetModal}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot or need to set password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <p>{error}</p>
              {error.includes('Forgot / Set Password') && (
                <button
                  type="button"
                  onClick={handleOpenResetModal}
                  className="mt-2 text-xs font-semibold text-blue-700 underline block"
                >
                  Reset your password here &rarr;
                </button>
              )}
            </div>
          )}

          <div>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reset Admin Password</h3>
                <p className="text-xs text-gray-500">
                  {resetStep === 'request'
                    ? 'Receive a verification code to set your password'
                    : `Enter verification code sent to ${resetEmail}`}
                </p>
              </div>
            </div>

            {resetError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
                {resetSuccess}
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <Input
                  label="Administrator Email"
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@alibaanah.com"
                  icon={<Mail className="h-4 w-4 text-gray-400" />}
                  required
                />
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={resetLoading}>
                    {resetLoading ? 'Sending Code...' : 'Send Verification Code'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label htmlFor="reset-code" className="block text-sm font-medium text-gray-700 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="block w-full px-3 py-2 text-center text-xl tracking-widest font-mono border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Check your inbox for the code (valid for 15 minutes)</p>
                </div>

                <Input
                  label="New Password"
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  icon={<Lock className="h-4 w-4 text-gray-400" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  required
                />

                <Input
                  label="Confirm New Password"
                  id="reset-confirm-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  icon={<Lock className="h-4 w-4 text-gray-400" />}
                  required
                />

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('request');
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Back
                  </button>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(false)}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <Button type="submit" disabled={resetLoading}>
                      {resetLoading ? 'Updating...' : 'Set New Password'}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
