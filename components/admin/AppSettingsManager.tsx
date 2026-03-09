import React, { useState, useEffect } from 'react';
import { getAppSettings, updateAppSetting } from '../../services/apiService';
import { AppSettings } from '../../types';
import Card from '../common/Card';
import Spinner from '../common/Spinner';
import Toggle from '../common/Toggle';

const AppSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    const isPending = { current: true };
    const timeoutId = setTimeout(() => {
        if (isPending.current) {
            setError("Request timed out. Please check your connection and try again.");
            setLoading(false);
        }
    }, 15000);

    try {
      const fetchedSettings = await getAppSettings();
      isPending.current = false;
      clearTimeout(timeoutId);
      setSettings(fetchedSettings);
    } catch (err) {
      isPending.current = false;
      clearTimeout(timeoutId);
      setError('Failed to load settings.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSettingChange = async (key: keyof AppSettings, value: boolean) => {
    if (!settings) return;

    const oldSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await updateAppSetting(key, value);
    } catch (err) {
      setError('Failed to update setting. Please try again.');
      setSettings(oldSettings); // Revert on failure
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <button 
        onClick={fetchSettings}
        className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-dark transition-colors"
      >
        Retry
      </button>
    </div>
  );
  if (!settings) return <p className="p-8 text-center">No settings found.</p>;

  return (
    <Card title="Application Settings">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-semibold">Student Registration</h3>
            <p className="text-sm text-gray-500">Enable or disable the student registration and appointment booking functionality.</p>
          </div>
          <Toggle 
            enabled={settings.isRegistrationOpen}
            onChange={(enabled) => handleSettingChange('isRegistrationOpen', enabled)}
          />
        </div>
      </div>
    </Card>
  );
};

export default AppSettingsManager;
