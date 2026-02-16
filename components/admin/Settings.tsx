
import React, { useEffect, useState } from 'react';
import { getAppSettings, updateAppSettings } from '../../services/mockApiService';
import { AppSettings as TAppSettings } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<TAppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const data = await getAppSettings();
                setSettings(data);
            } catch (error) {
                console.error("Failed to fetch app settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (field: keyof TAppSettings, value: string | number | boolean) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setSaved(false);
        await updateAppSettings(settings);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (loading) return <Spinner />;
    if (!settings) return <p>Could not load settings.</p>;

    return (
        <Card title="Application Settings">
            <div className="space-y-6 max-w-lg">
                {/* Registration Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <h3 className="font-semibold text-gray-800">Registration Status</h3>
                        <p className="text-sm text-gray-500">Enable or disable new student registrations.</p>
                    </div>
                    <label htmlFor="registrationToggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id="registrationToggle" 
                                className="sr-only" 
                                checked={settings.registrationOpen}
                                onChange={(e) => handleChange('registrationOpen', e.target.checked)}
                            />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.registrationOpen ? 'transform translate-x-6 bg-green-400' : ''}`}></div>
                        </div>
                    </label>
                </div>

                {/* Daily Capacity */}
                <div className="p-4 border rounded-lg">
                     <h3 className="font-semibold text-gray-800 mb-2">Campus Capacity</h3>
                    <Input 
                        label="Max Daily Campus Visitors"
                        type="number"
                        value={settings.maxDailyCapacity}
                        onChange={(e) => handleChange('maxDailyCapacity', parseInt(e.target.value))}
                        min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Set the total number of students that can be on campus per day across all levels.</p>
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

export default Settings;
