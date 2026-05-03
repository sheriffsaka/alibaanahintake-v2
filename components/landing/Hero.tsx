import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, X, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { Gender } from '../../types';
import { useSiteContent } from '../../contexts/SiteContentContext';
import { getAppSettings } from '../../services/apiService';
import { AppSettings } from '../../types';

const Hero: React.FC = () => {
    const { t, language } = useTranslation();
    const { content } = useSiteContent();
    const [isVideoModalOpen, setVideoModalOpen] = useState(false);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [closedModal, setClosedModal] = useState<{ isOpen: boolean, gender?: Gender } | null>(null);
    const [hasSavedEnrollment] = useState(() => {
        const saved = localStorage.getItem('al_ibaanah_enrollment_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const isRecent = Date.now() - (parsed.timestamp || 0) < 2 * 60 * 60 * 1000;
                return !!(isRecent && !parsed.confirmedRegistration);
            } catch {
                return false;
            }
        }
        return false;
    });

    const steps = [
        { number: 1, text: t('step1') },
        { number: 2, text: t('step2') },
        { number: 3, text: t('step3') },
    ];

    const rawVideoUrl = content?.heroVideoUrl?.[language] || content?.heroVideoUrl?.en || '';

    // Helper to ensure video URLs are embeddable (especially for Google Drive)
    const formatVideoUrl = (url: string) => {
        if (!url) return '';
        
        // Handle Google Drive links
        if (url.includes('drive.google.com')) {
            // Remove any trailing parameters like ?usp=sharing
            const baseDir = url.split('?')[0];
            if (baseDir.includes('/view')) {
                return baseDir.replace('/view', '/preview');
            }
            if (baseDir.includes('/file/d/') && !baseDir.includes('/preview')) {
                const idMatch = baseDir.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (idMatch && idMatch[1]) {
                    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
                }
            }
        }

        // Handle standard YouTube links to embed format
        if (url.includes('youtube.com/watch?v=')) {
            try {
                const urlObj = new URL(url);
                const id = urlObj.searchParams.get('v');
                if (id) return `https://www.youtube.com/embed/${id}`;
            } catch { /* ignore */ }
        }
        if (url.includes('youtu.be/')) {
            const id = url.split('youtu.be/')[1]?.split('?')[0];
            if (id) return `https://www.youtube.com/embed/${id}`;
        }

        return url;
    };

    const videoUrl = formatVideoUrl(rawVideoUrl);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settings = await getAppSettings();
                setAppSettings(settings);
            } catch (error) {
                console.error("Failed to fetch app settings:", error);
            }
        };
        fetchSettings();
    }, []);

    const handleRegistrationClick = (e: React.MouseEvent, gender: Gender) => {
        if (!appSettings) return;

        const now = new Date();
        const startTime = appSettings.bookingStartTime ? new Date(appSettings.bookingStartTime) : null;
        const endTime = appSettings.bookingEndTime ? new Date(appSettings.bookingEndTime) : null;

        // Check if booking has not started yet
        if (startTime && now < startTime) {
            e.preventDefault();
            const formattedStart = startTime.toLocaleString(undefined, { 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            alert(`Booking has not started yet. It will open on ${formattedStart}.`);
            return;
        }

        // Check if booking has ended
        if (endTime && now > endTime) {
            e.preventDefault();
            alert("Booking has already closed for this session.");
            return;
        }

        const isMainOpen = appSettings.isRegistrationOpen;
        const isSectionOpen = gender === Gender.Male 
            ? appSettings.isMaleRegistrationOpen 
            : appSettings.isFemaleRegistrationOpen;

        if (!isMainOpen || !isSectionOpen) {
            e.preventDefault();
            setClosedModal({ isOpen: true, gender });
        }
    };

    const getClosedMessage = (gender?: Gender) => {
        if (!appSettings) return '';
        
        const now = new Date();
        const startTime = appSettings.bookingStartTime ? new Date(appSettings.bookingStartTime) : null;
        const endTime = appSettings.bookingEndTime ? new Date(appSettings.bookingEndTime) : null;

        if (startTime && now < startTime) {
            return language === 'ar' ? 'التسجيل لم يبدأ بعد' : "Registration hasn't started yet.";
        }

        if (endTime && now > endTime) {
            return language === 'ar' ? 'تم إغلاق التسجيل لهذه الدورة' : "Registration has ended for this session.";
        }

        const lang = language || 'en';
        const customMessage = appSettings.closedReasons?.[lang] || appSettings.closedReasons?.en;
        
        if (customMessage) return customMessage;

        // Default messages if none set
        if (!gender) return "Registration is currently closed. Please contact the school for further notice.";

        return gender === Gender.Male
            ? "Registration for the Brothers section is currently closed. Please contact the school for further notice."
            : "Registration for the Sisters section is currently closed. Please contact the school for further notice.";
    };

    const isSectionActive = (gender: Gender) => {
        if (!appSettings) return false;
        
        const now = new Date();
        const startTime = appSettings.bookingStartTime ? new Date(appSettings.bookingStartTime) : null;
        const endTime = appSettings.bookingEndTime ? new Date(appSettings.bookingEndTime) : null;

        if (startTime && now < startTime) return false;
        if (endTime && now > endTime) return false;

        const isMainOpen = appSettings.isRegistrationOpen;
        const isGenderOpen = gender === Gender.Male 
            ? appSettings.isMaleRegistrationOpen 
            : appSettings.isFemaleRegistrationOpen;

        return isMainOpen && isGenderOpen;
    };

  return (
    <>
    <section 
        id="home" 
        className="relative bg-brand-green-dark text-white overflow-hidden"
        style={{
            backgroundImage: `
                radial-gradient(circle at top left, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 20%),
                radial-gradient(circle at bottom right, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 25%)
            `
        }}
    >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
            <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left Content */}
                <div className="relative z-10">
                    <div className="inline-block bg-brand-yellow text-brand-green-dark text-xs font-bold px-3 py-1 rounded-md mb-6">
                        {t('assessmentIntakePortal')}
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                        {t('yourJourney')}
                        <br />
                        <span className="text-brand-yellow">{t('startsOnCampus')}</span>
                    </h1>
                    <p className="mt-6 text-lg text-gray-300 max-w-lg">
                        {t('heroDescription')}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-4">
                        {hasSavedEnrollment && (
                            <div className="w-full mb-2">
                                <Link to="/enroll">
                                    <button className="bg-brand-yellow text-brand-green-dark font-bold px-8 py-3 rounded-md shadow-xl hover:bg-yellow-400 transition-all transform hover:scale-105 flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5" />
                                        <span>{t('returnToBooking')}</span>
                                    </button>
                                </Link>
                            </div>
                        )}
                        
                        <Link 
                            to="/enroll" 
                            state={{ gender: Gender.Male }}
                            onClick={(e) => handleRegistrationClick(e, Gender.Male)}
                        >
                            <button className={`font-semibold px-8 py-3 rounded-md shadow-lg transition-all ${
                                isSectionActive(Gender.Male)
                                ? 'bg-white text-brand-green-dark hover:bg-gray-200' 
                                : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-70'
                            }`}>
                                {t('maleIntake')}
                            </button>
                        </Link>
                        <Link 
                            to="/enroll" 
                            state={{ gender: Gender.Female }}
                            onClick={(e) => handleRegistrationClick(e, Gender.Female)}
                        >
                            <button className={`font-semibold px-8 py-3 rounded-md flex items-center transition-all ${
                                isSectionActive(Gender.Female)
                                ? 'border border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10'
                                : 'border border-gray-500 text-gray-500 cursor-not-allowed opacity-70'
                            }`}>
                                <span>{t('femaleIntake')}</span>
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Right Content - Steps with Video Overlay */}
                <div className="relative group cursor-pointer" onClick={() => setVideoModalOpen(true)}>
                     <div className="absolute inset-0 bg-white/5 rounded-3xl transform -rotate-3 transition-transform duration-300 group-hover:rotate-0"></div>
                     <div className="relative bg-black/10 backdrop-blur-sm p-8 rounded-2xl border border-white/10 space-y-4">
                        {steps.map((step, index) => (
                            <div
                                key={step.number}
                                className={`flex items-center p-4 rounded-xl
                                    ${index < 2 ? 'bg-brand-yellow text-brand-green-dark' : 'bg-white/10 text-white'}
                                `}
                            >
                                <div className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full font-bold
                                     ${index < 2 ? 'bg-brand-green-dark text-brand-yellow' : 'bg-white/20'}
                                `}>
                                    {step.number}
                                </div>
                                <p className="ml-4 font-semibold">{step.text}</p>
                            </div>
                        ))}
                    </div>
                    {/* Video Overlay */}
                    <div className="absolute inset-0 bg-brand-green-dark/70 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <PlayCircle className="h-20 w-20 text-white/80 transform group-hover:scale-110 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
    </section>

    {/* Video Modal */}
    {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setVideoModalOpen(false)}>
            <div className="bg-black rounded-lg w-full max-w-3xl aspect-video relative" onClick={(e) => e.stopPropagation()}>
                <button 
                    onClick={() => setVideoModalOpen(false)}
                    className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg hover:bg-gray-200 z-10"
                >
                    <X className="h-6 w-6 text-gray-800" />
                </button>
                <iframe 
                    className="w-full h-full rounded-lg"
                    src={videoUrl}
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                </iframe>
            </div>
        </div>
    )}

    {/* Registration Closed Modal */}
    {closedModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setClosedModal(null)}>
            <div 
                className="bg-white rounded-xl max-w-md w-full p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-4 right-4">
                    <button 
                        onClick={() => setClosedModal(null)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="text-center">
                    <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <X className="h-8 w-8 text-yellow-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                        {language === 'ar' ? 'التسجيل مغلق' : 'Registration Closed'}
                    </h3>
                    <div className="text-gray-600 leading-relaxed space-y-4 mb-8">
                        <p className="text-lg font-medium">
                            {getClosedMessage(closedModal.gender)}
                        </p>
                    </div>
                    <button 
                        onClick={() => setClosedModal(null)}
                        className="w-full bg-brand-green text-white font-bold py-3 rounded-lg shadow-lg hover:bg-brand-green-dark transition-all transform active:scale-95"
                    >
                        {language === 'ar' ? 'حسناً' : 'Understood'}
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Hero;