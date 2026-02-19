import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, PlayCircle, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { Gender } from '../../types';
import { useSiteContent } from '../../contexts/SiteContentContext';

const Hero: React.FC = () => {
    const { t, language } = useTranslation();
    const { content } = useSiteContent();
    const [isVideoModalOpen, setVideoModalOpen] = useState(false);

    const steps = [
        { number: 1, text: t('step1') },
        { number: 2, text: t('step2') },
        { number: 3, text: t('step3') },
    ];

    const videoUrl = content?.heroVideoUrl?.[language] || content?.heroVideoUrl?.en || '';

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
                        <Link to="/enroll" state={{ gender: Gender.Male }}>
                            <button className="bg-white text-brand-green-dark font-semibold px-8 py-3 rounded-md shadow-lg hover:bg-gray-200 transition-colors">
                                {t('maleIntake')}
                            </button>
                        </Link>
                        <Link to="/enroll" state={{ gender: Gender.Female }}>
                            <button className="border border-brand-yellow text-brand-yellow font-semibold px-8 py-3 rounded-md flex items-center hover:bg-brand-yellow/10 transition-colors">
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
    </>
  );
};

export default Hero;