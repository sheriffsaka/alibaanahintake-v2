
import React, { useEffect, useState } from 'react';
import { getAppSettings, updateAppSettings } from '../../services/apiService';
import { AppSettings as TAppSettings } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Toggle from '../common/Toggle';
import { CheckCircle, Info } from 'lucide-react';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<TAppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const data = await getAppSettings();
                setSettings(data);
            } catch (error) {
                console.error("Failed to fetch app settings", error);
                setError("Failed to load settings. Please refresh the page.");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (field: keyof TAppSettings, value: TAppSettings[keyof TAppSettings]) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    const handleReasonChange = (lang: string, reason: string) => {
        if (!settings) return;
        const updatedReasons = { ...settings.closedReasons, [lang]: reason };
        handleChange('closedReasons', updatedReasons);
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await updateAppSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Failed to save settings", err);
            setError("Failed to save specific settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
    if (error && !settings) return (
        <div className="p-8 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
    );
    if (!settings) return <p className="p-8 text-center text-gray-500">No settings found.</p>;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Application Settings</h1>
                    <p className="text-gray-500">Manage global registration status, section availability, and facility capacity.</p>
                </div>
                <div className="flex items-center space-x-4">
                    {saved && <span className="text-green-600 flex items-center"><CheckCircle className="h-5 w-5 mr-1"/> Saved!</span>}
                    <Button onClick={handleSave} disabled={saving} loading={saving}>
                        Save All Changes
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Registration Management */}
                <div className="space-y-6">
                    <Card title="Global Registration Status">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <h3 className="font-semibold text-gray-800">Master Registration Switch</h3>
                                    <p className="text-xs text-gray-500 max-w-xs">Enable or disable registration across BOTH sections regardless of individual settings.</p>
                                </div>
                                <Toggle 
                                    enabled={settings.isRegistrationOpen}
                                    onChange={(enabled) => handleChange('isRegistrationOpen', enabled)}
                                />
                            </div>

                            <div className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-md text-sm">
                                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>When this is toggled OFF, all enrollment buttons on the landing page will trigger the &quot;Closed&quot; message.</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Section Availability">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <h3 className="font-semibold text-gray-800">Brothers Section</h3>
                                    <p className="text-xs text-gray-500">Enable/Disable male registration.</p>
                                </div>
                                <Toggle 
                                    enabled={settings.isMaleRegistrationOpen}
                                    onChange={(enabled) => handleChange('isMaleRegistrationOpen', enabled)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <h3 className="font-semibold text-gray-800">Sisters Section</h3>
                                    <p className="text-xs text-gray-500">Enable/Disable female registration.</p>
                                </div>
                                <Toggle 
                                    enabled={settings.isFemaleRegistrationOpen}
                                    onChange={(enabled) => handleChange('isFemaleRegistrationOpen', enabled)}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card title="Facility Limits">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <h3 className="font-semibold text-gray-800 mb-2">Campus Daily Capacity</h3>
                            <Input 
                                label="Maximum Daily Visitors"
                                type="number"
                                value={settings.maxDailyCapacity}
                                onChange={(e) => handleChange('maxDailyCapacity', parseInt(e.target.value))}
                                min="0"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Controls how many appointment slots are generated per day. 
                                Reducing this mid-operation will NOT delete existing bookings but will prevent new ones once reached.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Content Management (Closed messages) */}
                <div className="space-y-6">
                    <Card title="Registration Closed Notices">
                        <div className="space-y-6">
                            <p className="text-sm text-gray-500">
                                These messages appear in the popup when a student attempts to register for a closed section.
                            </p>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 font-semibold">English Notice</label>
                                <textarea 
                                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-brand-green focus:border-brand-green shadow-sm min-h-[120px]"
                                    value={settings.closedReasons.en || ''}
                                    onChange={(e) => handleReasonChange('en', e.target.value)}
                                    placeholder="e.g. Registration is currently full for this session. Please check back next intake."
                                />
                            </div>

                            <div className="pt-4 border-t">
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right font-semibold">تنبيه إغلاق التسجيل (العربية)</label>
                                <textarea 
                                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-brand-green focus:border-brand-green shadow-sm min-h-[120px] text-right"
                                    dir="rtl"
                                    value={settings.closedReasons.ar || ''}
                                    onChange={(e) => handleReasonChange('ar', e.target.value)}
                                    placeholder="مثلاً: التسجيل مغلق حالياً لهذه الدورة. يرجى المحاولة في الدورة القادمة."
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            
            <div className="flex items-center justify-end pt-6 border-t">
                {saved && <span className="text-green-600 flex items-center mr-4"><CheckCircle className="h-5 w-5 mr-1"/> Saved!</span>}
                <Button onClick={handleSave} disabled={saving} loading={saving} className="px-8">
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

export default Settings;
