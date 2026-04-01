
import React, { useEffect, useState } from 'react';
import { getNotificationSettings, updateNotificationSettings, sendTestEmail, triggerReminders } from '../../services/apiService';
import { NotificationSettings as TNotificationSettings } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { CheckCircle, Send, Play, ShieldCheck } from 'lucide-react';

const NotificationSettings: React.FC = () => {
    const [settings, setSettings] = useState<TNotificationSettings | null>(null);
    const [selectedLang, setSelectedLang] = useState<string>('en');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [testEmail, setTestEmail] = useState('');
    const [cronSecret, setCronSecret] = useState('');
    const [runningReminders, setRunningReminders] = useState(false);
    const [cronResult, setCronResult] = useState<unknown>(null);

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'Arabic' },
        { code: 'fr', name: 'French' },
        { code: 'zh', name: 'Chinese' },
        { code: 'uz', name: 'Uzbek' },
        { code: 'ru', name: 'Russian' },
    ];

    const fetchSettings = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const data = await getNotificationSettings();
            setSettings(data);
        } catch (error) {
            console.error("Failed to fetch notification settings", error);
            setError("Failed to load settings. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (type: 'confirmation' | 'reminder24h' | 'reminderDayOf', field: 'subject' | 'body' | 'enabled', value: string | boolean) => {
        if (!settings || !selectedLang) return;
        const langSettings = settings[selectedLang] || {
            confirmation: { enabled: true, subject: '', body: '' },
            reminder24h: { enabled: true, subject: '', body: '' },
            reminderDayOf: { enabled: false, subject: '', body: '' }
        };

        setSettings({
            ...settings,
            [selectedLang]: {
                ...langSettings,
                [type]: {
                    ...langSettings[type],
                    [field]: value,
                }
            }
        });
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setSaved(false);
        try {
            await updateNotificationSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Failed to save settings", err);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async (type: 'confirmation' | 'reminder24h' | 'reminderDayOf') => {
        if (!settings || !testEmail || !selectedLang) {
            alert("Please enter a test email address.");
            return;
        }
        
        const langSettings = settings[selectedLang];
        if (!langSettings) return;

        setTesting(type);
        try {
            let body = langSettings[type].body;
            // Basic placeholder replacement for test
            body = body.replace(/{{studentName}}/g, 'Test Student');
            body = body.replace(/{{level}}/g, 'Level 1');
            body = body.replace(/{{appointmentDate}}/g, new Date().toLocaleDateString());
            body = body.replace(/{{appointmentTime}}/g, '10:00 AM - 11:00 AM');
            body = body.replace(/{{registrationCode}}/g, 'AIB-TEST-001');

            await sendTestEmail(testEmail, `[TEST] [${selectedLang.toUpperCase()}] ${langSettings[type].subject}`, body.replace(/\n/g, '<br>'));
            alert("Test email sent successfully!");
        } catch (error) {
            console.error("Test email failed:", error);
            alert(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setTesting(null);
        }
    };

    const handleRunReminders = async () => {
        if (!cronSecret) {
            alert("Please enter the CRON_SECRET to trigger reminders.");
            return;
        }

        setRunningReminders(true);
        setCronResult(null);
        try {
            const result = await triggerReminders(cronSecret);
            setCronResult(result);
            alert("Reminders processed successfully!");
        } catch (error) {
            console.error("Failed to trigger reminders:", error);
            alert(`Failed to trigger reminders: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setRunningReminders(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-red-600 font-medium">{error}</p>
                <Button onClick={fetchSettings}>
                    Retry
                </Button>
            </div>
        );
    }

    if (!settings) return <p>Could not load settings.</p>;

    const currentLangSettings = settings[selectedLang] || {
        confirmation: { enabled: true, subject: '', body: '' },
        reminder24h: { enabled: true, subject: '', body: '' },
        reminderDayOf: { enabled: false, subject: '', body: '' }
    };

    const renderNotificationSection = (
        type: 'confirmation' | 'reminder24h' | 'reminderDayOf', 
        title: string
    ) => (
        <div className="border p-4 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
                <div className="flex items-center gap-4">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleSendTest(type)}
                        disabled={!!testing || !currentLangSettings[type].enabled}
                        className="flex items-center"
                    >
                        <Send className="h-3 w-3 mr-1" />
                        {testing === type ? 'Sending...' : 'Test'}
                    </Button>
                    <label htmlFor={`${type}Toggle`} className="flex items-center cursor-pointer">
                        <span className="mr-3 text-sm font-medium text-gray-900">{currentLangSettings[type].enabled ? 'Enabled' : 'Disabled'}</span>
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id={`${type}Toggle`} 
                                className="sr-only" 
                                checked={currentLangSettings[type].enabled}
                                onChange={(e) => handleChange(type, 'enabled', e.target.checked)}
                            />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${currentLangSettings[type].enabled ? 'transform translate-x-6 bg-green-400' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </div>
            <div className={`space-y-4 transition-opacity ${currentLangSettings[type].enabled ? 'opacity-100' : 'opacity-50'}`}>
                <Input 
                    label="Subject" 
                    value={currentLangSettings[type].subject}
                    onChange={(e) => handleChange(type, 'subject', e.target.value)}
                    disabled={!currentLangSettings[type].enabled}
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                    value={currentLangSettings[type].body}
                    onChange={(e) => handleChange(type, 'body', e.target.value)}
                    rows={6}
                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                    disabled={!currentLangSettings[type].enabled}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <Card title="Notification Settings">
                <p className="mb-6 text-gray-600">
                    Enable, disable, and edit the email templates sent to students. You can use placeholders like {"{{studentName}}"}, {"{{level}}"}, {"{{appointmentDate}}"}, {"{{appointmentTime}}"}, and {"{{registrationCode}}"} which will be replaced with actual data.
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Language to Edit</label>
                    <div className="flex flex-wrap gap-2">
                        {languages.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => setSelectedLang(lang.code)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    selectedLang === lang.code 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-1 w-full">
                        <Input 
                            label="Test Email Address" 
                            placeholder="Enter your email to receive tests"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-blue-600 sm:max-w-xs">
                        Enter an email address here to test your templates before saving.
                    </p>
                </div>

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

            <Card title="Automation & Cron Jobs">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        The 24-hour and Day-of reminders are automated via a cron job endpoint. You can trigger it manually here or set up an external service (like Cron-job.org) to hit the endpoint daily.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <Input 
                            label="Cron Secret Token" 
                            type="password"
                            placeholder="Enter CRON_SECRET to trigger"
                            value={cronSecret}
                            onChange={(e) => setCronSecret(e.target.value)}
                            icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                        />
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleRunReminders} 
                                disabled={runningReminders}
                                className="flex-1 flex items-center justify-center"
                            >
                                <Play className="h-4 w-4 mr-2" />
                                {runningReminders ? 'Running...' : 'Run Reminders Now'}
                            </Button>
                        </div>
                    </div>

                    {cronResult && (
                        <div className="mt-4 p-4 bg-gray-50 border rounded-lg text-xs font-mono">
                            <h4 className="font-bold mb-2 text-gray-700">Last Run Result:</h4>
                            <pre>{JSON.stringify(cronResult, null, 2)}</pre>
                        </div>
                    )}

                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="text-sm font-bold text-yellow-800 mb-1">Setup Instructions:</h4>
                        <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                            <li>Endpoint: <code className="bg-yellow-100 px-1">POST /api/cron/reminders</code></li>
                            <li>Header: <code className="bg-yellow-100 px-1">Authorization: Bearer YOUR_CRON_SECRET</code></li>
                            <li>Schedule: Set to run once daily (e.g., at 8:00 AM).</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default NotificationSettings;