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

  const handleSettingChange = async (key: keyof AppSettings, value: unknown) => {
    if (!settings) return;

    const oldSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings as AppSettings);

    try {
      await updateAppSetting(key, value);
    } catch (err) {
      setError('Failed to update setting. Please try again.');
      setSettings(oldSettings); // Revert on failure
      console.error(err);
    }
  };

  const handleReasonChange = (lang: string, reason: string) => {
    const updatedReasons = { ...settings?.closedReasons, [lang]: reason };
    handleSettingChange('closedReasons', updatedReasons);
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
    <div className="space-y-6">
      <Card title="Global Registration Status">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold text-lg">Main Registration Switch</h3>
              <p className="text-sm text-gray-500">Enable or disable all student registration across all sections.</p>
            </div>
            <Toggle 
                enabled={settings.isRegistrationOpen}
                onChange={(enabled) => handleSettingChange('isRegistrationOpen', enabled)}
            />
          </div>
        </div>
      </Card>

      <Card title="Section Specific Registration">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Male Section (Brothers)</h3>
              <p className="text-sm text-gray-500">Enable registration for male students.</p>
            </div>
            <Toggle 
              enabled={settings.isMaleRegistrationOpen}
              onChange={(enabled) => handleSettingChange('isMaleRegistrationOpen', enabled)}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Female Section (Sisters)</h3>
              <p className="text-sm text-gray-500">Enable registration for female students.</p>
            </div>
            <Toggle 
              enabled={settings.isFemaleRegistrationOpen}
              onChange={(enabled) => handleSettingChange('isFemaleRegistrationOpen', enabled)}
            />
          </div>
        </div>
      </Card>

      <Card title="Registration Closed Message">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">This message will be shown to students when registration is disabled for their section.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">English Message</label>
              <textarea 
                className="w-full border rounded-md p-2 text-sm focus:ring-brand-green focus:border-brand-green"
                rows={3}
                value={settings.closedReasons.en || ''}
                onChange={(e) => handleReasonChange('en', e.target.value)}
                placeholder="e.g. Registration is currently full for this session..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arabic Message</label>
              <textarea 
                className="w-full border rounded-md p-2 text-sm focus:ring-brand-green focus:border-brand-green text-right"
                dir="rtl"
                rows={3}
                value={settings.closedReasons.ar || ''}
                onChange={(e) => handleReasonChange('ar', e.target.value)}
                placeholder="مثلاً، التسجيل مكتمل حالياً لهذه الدورة..."
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AppSettingsManager;
