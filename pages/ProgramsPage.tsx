
import React, { useEffect, useState } from 'react';
import { getPrograms } from '../services/apiService';
import { Program } from '../types';
import Spinner from '../components/common/Spinner';
import Footer from '../components/landing/Footer';
import ProgramDisplay from '../components/landing/ProgramDisplay';
import { useTranslation } from '../i18n/LanguageContext';
import { Library } from 'lucide-react';

const ProgramsPage: React.FC = () => {
    const { t } = useTranslation();
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrograms = async () => {
            setLoading(true);
            try {
                const data = await getPrograms();
                setPrograms(data);
            } catch (err) {
                console.error("Failed to fetch programs", err);
                setError("Failed to load programs. Please try again later.");
            } finally {
                setLoading(false);
            }
        };
        fetchPrograms();
    }, []);

    return (
        <div className="bg-gray-50">
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 min-h-[calc(100vh-10rem)]">
                <div className="text-center mb-12">
                    <Library className="h-16 w-16 mx-auto text-brand-green mb-4" />
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800">{t('programsPageTitle')}</h1>
                    <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">{t('programsPageDescription')}</p>
                </div>

                {loading ? (
                    <Spinner />
                ) : error ? (
                    <p className="text-center text-red-500">{error}</p>
                ) : programs.length > 0 ? (
                    <div className="space-y-8 max-w-4xl mx-auto">
                        {programs.map(program => (
                            <ProgramDisplay key={program.id} program={program} />
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500">{t('noProgramsAvailable')}</p>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default ProgramsPage;
