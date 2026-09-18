
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, UserCircle, KeyRound, X } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Button from '../common/Button';
import Input from '../common/Input';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStatus(null);
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStatus(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setPasswordStatus({ type: 'error', message: error.message });
      } else {
        setPasswordStatus({ type: 'success', message: 'Password changed successfully!' });
        setTimeout(() => {
          handleClosePasswordModal();
        }, 1500);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setPasswordStatus({ type: 'error', message: errorObj?.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 md:ml-0 ml-16">
        <div className="flex items-center">
          {/* Can add breadcrumbs or page title here */}
        </div>
        <div className="flex items-center space-x-3">
          {user && (
            <div className="flex items-center mr-2">
              <UserCircle className="h-8 w-8 text-gray-500 mr-2" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleOpenPasswordModal}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="Change Password"
          >
            <KeyRound size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={handleClosePasswordModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Change Password</h3>
            <p className="text-xs text-gray-500 mb-4">
              Set a new private password for your account ({user?.email}).
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />

              {passwordStatus && (
                <div
                  className={`p-3 rounded text-sm ${
                    passwordStatus.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {passwordStatus.message}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="secondary" onClick={handleClosePasswordModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
