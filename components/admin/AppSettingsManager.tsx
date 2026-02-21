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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const fetchedSettings = await getAppSettings();
        setSettings(fetchedSettings);
      } catch (err) {
        setError('Failed to load settings.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
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

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!settings) return <p>No settings found.</p>;

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
