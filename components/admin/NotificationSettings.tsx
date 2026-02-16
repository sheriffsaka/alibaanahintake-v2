
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

    const handleChange = (type: keyof TNotificationSettings, field: 'subject' | 'body', value: string) => {
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

    return (
        <Card title="Notification Settings">
            <p className="mb-6 text-gray-600">
                Edit the email templates sent to students. You can use placeholders like {"{{studentName}}"}, {"{{level}}"}, {"{{appointmentDate}}"}, {"{{appointmentTime}}"}, and {"{{registrationCode}}"} which will be replaced with actual data.
            </p>
            <div className="space-y-8">
                {/* Confirmation Email */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Confirmation Email</h3>
                    <div className="space-y-4">
                        <Input 
                            label="Subject" 
                            value={settings.confirmation.subject}
                            onChange={(e) => handleChange('confirmation', 'subject', e.target.value)}
                        />
                        <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                        <textarea
                            value={settings.confirmation.body}
                            onChange={(e) => handleChange('confirmation', 'body', e.target.value)}
                            rows={6}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                        />
                    </div>
                </div>

                {/* 24-Hour Reminder */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">24-Hour Reminder Email</h3>
                    <div className="space-y-4">
                        <Input 
                            label="Subject" 
                            value={settings.reminder24h.subject}
                            onChange={(e) => handleChange('reminder24h', 'subject', e.target.value)}
                        />
                         <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                        <textarea
                            value={settings.reminder24h.body}
                            onChange={(e) => handleChange('reminder24h', 'body', e.target.value)}
                            rows={6}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                        />
                    </div>
                </div>
                 {/* Day Of Reminder */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Day-Of Reminder Email</h3>
                    <div className="space-y-4">
                        <Input 
                            label="Subject" 
                            value={settings.reminderDayOf.subject}
                            onChange={(e) => handleChange('reminderDayOf', 'subject', e.target.value)}
                        />
                         <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                        <textarea
                            value={settings.reminderDayOf.body}
                            onChange={(e) => handleChange('reminderDayOf', 'body', e.target.value)}
                            rows={6}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                        />
                    </div>
                </div>
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
