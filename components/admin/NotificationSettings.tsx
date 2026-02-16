
import React, { useEffect, useState } from 'react';
import { getNotificationSettings, updateNotificationSettings } from '../../services/mockApiService';
import { NotificationSettings as TNotificationSettings } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { CheckCircle } from 'lucide-react';

const NotificationSettings: React.FC = () => {
    const [settings, setSettings] = useState<TNotificationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const data = await getNotificationSettings();
                setSettings(data);
            } catch (error) {
                console.error("Failed to fetch notification settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (type: keyof TNotificationSettings, field: 'subject' | 'body' | 'enabled', value: string | boolean) => {
        if (!settings) return;
        setSettings({
            ...settings,
            [type]: {
                ...settings[type],
                [field]: value,
            }
        });
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setSaved(false);
        await updateNotificationSettings(settings);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (loading) return <Spinner />;
    if (!settings) return <p>Could not load settings.</p>;

    const renderNotificationSection = (
        type: keyof TNotificationSettings, 
        title: string
    ) => (
        <div>
            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
                <label htmlFor={`${type}Toggle`} className="flex items-center cursor-pointer">
                    <span className="mr-3 text-sm font-medium text-gray-900">{settings[type].enabled ? 'Enabled' : 'Disabled'}</span>
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            id={`${type}Toggle`} 
                            className="sr-only" 
                            checked={settings[type].enabled}
                            onChange={(e) => handleChange(type, 'enabled', e.target.checked)}
                        />
                        <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings[type].enabled ? 'transform translate-x-6 bg-green-400' : ''}`}></div>
                    </div>
                </label>
            </div>
            <div className={`space-y-4 transition-opacity ${settings[type].enabled ? 'opacity-100' : 'opacity-50'}`}>
                <Input 
                    label="Subject" 
                    value={settings[type].subject}
                    onChange={(e) => handleChange(type, 'subject', e.target.value)}
                    disabled={!settings[type].enabled}
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                    value={settings[type].body}
                    onChange={(e) => handleChange(type, 'body', e.target.value)}
                    rows={6}
                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                    disabled={!settings[type].enabled}
                />
            </div>
        </div>
    );

    return (
        <Card title="Notification Settings">
            <p className="mb-6 text-gray-600">
                Enable, disable, and edit the email templates sent to students. You can use placeholders like {"{{studentName}}"}, {"{{level}}"}, {"{{appointmentDate}}"}, {"{{appointmentTime}}"}, and {"{{registrationCode}}"} which will be replaced with actual data.
            </p>
            <div className="space-y-8">
                {renderNotificationSection('confirmation', 'Confirmation Email')}
                {renderNotificationSection('reminder24h', '24-Hour Reminder Email')}
                {renderNotificationSection('reminderDayOf', 'Day-Of Reminder Email')}
            </div>
            <div className="mt-8 flex items-center justify-end">
                {saved && <span className="text-green-600 flex items-center mr-4"><CheckCircle className="h-5 w-5 mr-1"/> Saved!</span>}
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save All Changes'}
                </Button>
            </div>
        </Card>
    );
};

export default NotificationSettings;
