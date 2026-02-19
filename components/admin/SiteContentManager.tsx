import React, { useEffect, useState } from 'react';
import { getSiteContent, updateSiteContent } from '../../services/apiService';
import { SiteContent, FaqItem } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { CheckCircle, PlusCircle, Trash2 } from 'lucide-react';
import { langs } from '../../i18n/locales';

type LangKey = keyof typeof langs;

const SiteContentManager: React.FC = () => {
    const [content, setContent] = useState<SiteContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeFaqLang, setActiveFaqLang] = useState<LangKey>('en');

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const data = await getSiteContent();
                // Ensure all lang keys exist for FAQs
                const faqItemsWithAllLangs = { ...data.faqItems };
                for (const langKey in langs) {
                    if (!faqItemsWithAllLangs[langKey]) {
                        faqItemsWithAllLangs[langKey] = [];
                    }
                }
                setContent({ ...data, faqItems: faqItemsWithAllLangs });
            } catch (error) {
                console.error("Failed to fetch site content", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!content) return;
        const { name, value } = e.target;
        setContent({ ...content, [name]: value });
    };

    const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
        if (!content) return;
        const newFaqsByLang = { ...content.faqItems };
        const currentLangFaqs = [...(newFaqsByLang[activeFaqLang] || [])];
        currentLangFaqs[index][field] = value;
        newFaqsByLang[activeFaqLang] = currentLangFaqs;
        setContent({ ...content, faqItems: newFaqsByLang });
    };
    
    const addFaqItem = () => {
        if (!content) return;
        const newFaqsByLang = { ...content.faqItems };
        const currentLangFaqs = [...(newFaqsByLang[activeFaqLang] || [])];
        currentLangFaqs.push({ question: '', answer: '' });
        newFaqsByLang[activeFaqLang] = currentLangFaqs;
        setContent({ ...content, faqItems: newFaqsByLang });
    };

    const removeFaqItem = (index: number) => {
        if (!content) return;
        const newFaqsByLang = { ...content.faqItems };
        const currentLangFaqs = (newFaqsByLang[activeFaqLang] || []).filter((_, i) => i !== index);
        newFaqsByLang[activeFaqLang] = currentLangFaqs;
        setContent({ ...content, faqItems: newFaqsByLang });
    };

    const handleSave = async () => {
        if (!content) return;
        setSaving(true);
        setSaved(false);
        try {
            const updatePromises = Object.entries(content).map(([key, value]) => 
                updateSiteContent(key as keyof SiteContent, value)
            );
            await Promise.all(updatePromises);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Failed to save site content:", error);
            alert("An error occurred while saving. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Spinner />;
    if (!content) return <p>Could not load site content.</p>;

    return (
        <Card title="Site Content Management">
            <div className="space-y-8">
                {/* General Settings */}
                <Card title="General" className="bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Logo URL" name="logoUrl" value={content.logoUrl} onChange={handleInputChange} />
                        <Input label="Official Site URL" name="officialSiteUrl" value={content.officialSiteUrl} onChange={handleInputChange} />
                    </div>
                </Card>

                {/* Home Page Videos */}
                <Card title="Home Page Videos" className="bg-gray-50">
                    <p className="text-sm text-gray-600 mb-4">Provide the YouTube embed URL for each language.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(Object.keys(langs) as LangKey[]).map(langKey => (
                            <Input 
                                key={langKey}
                                label={`Video URL (${langs[langKey].nativeName})`} 
                                name={`heroVideoUrl.${langKey}`} 
                                value={content.heroVideoUrl[langKey] || ''}
                                onChange={(e) => {
                                    setContent({
                                        ...content,
                                        heroVideoUrl: {
                                            ...content.heroVideoUrl,
                                            [langKey]: e.target.value
                                        }
                                    });
                                }}
                            />
                        ))}
                     </div>
                </Card>

                {/* FAQ Section */}
                <Card title="FAQ Section" className="bg-gray-50">
                    <div className="border-b border-gray-200 mb-4">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            {(Object.keys(langs) as LangKey[]).map(langKey => (
                                <button
                                    key={langKey}
                                    onClick={() => setActiveFaqLang(langKey)}
                                    className={`${
                                        activeFaqLang === langKey
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                                >
                                    {langs[langKey].nativeName}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="space-y-4">
                        {(content.faqItems[activeFaqLang] || []).map((faq, index) => (
                            <div key={index} className="p-4 border rounded-lg bg-white relative">
                                <Button onClick={() => removeFaqItem(index)} variant="danger" className="absolute top-2 right-2 p-1 h-7 w-7"><Trash2 size={16}/></Button>
                                <Input label={`Question ${index + 1}`} value={faq.question} onChange={(e) => handleFaqChange(index, 'question', e.target.value)} />
                                <div className="mt-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer {index + 1}</label>
                                    <textarea value={faq.answer} onChange={(e) => handleFaqChange(index, 'answer', e.target.value)} rows={3} className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button onClick={addFaqItem} variant="secondary" className="mt-4 flex items-center"><PlusCircle className="h-4 w-4 mr-2"/>Add FAQ Item for {langs[activeFaqLang].nativeName}</Button>
                </Card>
                
                 {/* Campus Info */}
                <Card title="Campus Information" className="bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Campus Address" name="campusAddress" value={content.campusAddress} onChange={handleInputChange} />
                        <Input label="Campus Hours" name="campusHours" value={content.campusHours} onChange={handleInputChange} />
                    </div>
                </Card>
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

export default SiteContentManager;