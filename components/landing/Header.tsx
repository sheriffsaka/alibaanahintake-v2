
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AlIbaanahLogo from './AlIbaanahLogo';
import { ChevronDown, ExternalLink, Globe, Menu, X, LayoutDashboard, UserCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { langs } from '../../i18n/locales';
import { Gender, AppSettings } from '../../types';
import { useSiteContent } from '../../contexts/SiteContentContext';
import { useAuth } from '../../hooks/useAuth';
import { getAppSettings } from '../../services/apiService';

const Header: React.FC = () => {
  const { t, changeLanguage, language } = useTranslation();
  const { content } = useSiteContent();
  const { user } = useAuth();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [closedModal, setClosedModal] = useState<{ isOpen: boolean, gender?: Gender } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getAppSettings();
        setAppSettings(settings);
      } catch (error) {
        console.error("Header: Failed to fetch app settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleLangChange = (langKey: keyof typeof langs) => {
    changeLanguage(langKey);
    setLangDropdownOpen(false);
  };

  const handleRegistrationClick = (e: React.MouseEvent, gender: Gender) => {
    if (!appSettings) return;

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
    
    const lang = language || 'en';
    const customMessage = appSettings.closedReasons?.[lang] || appSettings.closedReasons?.en;
    
    if (customMessage) return customMessage;

    // Default messages if none set
    if (!gender) return t('registrationClosedMessage');

    return gender === Gender.Male
        ? t('maleRegistrationClosedMessage')
        : t('femaleRegistrationClosedMessage');
  };

  return (
    <header className="bg-white shadow-md z-50 sticky top-0">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center">
              <AlIbaanahLogo className="h-12 w-auto" logoUrl={content?.logoUrl} />
            </Link>
            <span className="text-xl font-light text-brand-green tracking-widest border-l-2 border-gray-200 pl-4 rtl:border-l-0 rtl:border-r-2 rtl:pr-4">
              INTAKEFLOW
            </span>
          </div>
          <nav className="hidden lg:flex items-center space-x-6">
            <div className="relative">
              <button 
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center text-sm font-medium text-gray-600 hover:text-brand-green"
              >
                <Globe className="h-4 w-4 mr-1" />
                <span>{langs[language].nativeName}</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border">
                  <ul className="py-1">
                    {(Object.keys(langs) as Array<keyof typeof langs>).map((langKey) => (
                       <li key={langKey}>
                        <button 
                            onClick={() => handleLangChange(langKey)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            {langs[langKey].nativeName}
                        </button>
                       </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <a href={content?.officialSiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm font-medium text-gray-600 hover:text-brand-green">
              <span>{t('officialSite')}</span>
              <ExternalLink className="h-4 w-4 ml-1" />
            </a>

            <Link to="/manage-booking" className="flex items-center text-sm font-medium text-gray-600 hover:text-brand-green">
                <UserCircle className="h-4 w-4 mr-1 text-brand-green" />
                <span>{t('manageBooking')}</span>
            </Link>

            <div className="relative">
                <button 
                    onClick={() => setBookingDropdownOpen(!bookingDropdownOpen)}
                    onBlur={() => setTimeout(() => setBookingDropdownOpen(false), 200)}
                    className="bg-brand-green text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-brand-green-light transition-colors flex items-center"
                >
                    {t('bookAssessment')}
                    <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                {bookingDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border animate-in slide-in-from-top-2 duration-200">
                        <ul className="py-1">
                            <li>
                                <Link 
                                    to="/enroll" 
                                    state={{ gender: Gender.Male }} 
                                    onClick={(e) => { handleRegistrationClick(e, Gender.Male); setBookingDropdownOpen(false); }} 
                                    className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${(appSettings?.isRegistrationOpen && appSettings?.isMaleRegistrationOpen) ? '' : 'text-gray-400 font-normal italic'}`}
                                >
                                    {t('maleIntake')}
                                    {(!appSettings?.isRegistrationOpen || !appSettings?.isMaleRegistrationOpen) && <span className="ml-2 rounded text-[10px] bg-red-100 text-red-600 px-1 py-0.5 uppercase font-bold">{t('closed')}</span>}
                                </Link>
                            </li>
                            <li>
                                <Link 
                                    to="/enroll" 
                                    state={{ gender: Gender.Female }} 
                                    onClick={(e) => { handleRegistrationClick(e, Gender.Female); setBookingDropdownOpen(false); }} 
                                    className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${(appSettings?.isRegistrationOpen && appSettings?.isFemaleRegistrationOpen) ? '' : 'text-gray-400 font-normal italic'}`}
                                >
                                    {t('femaleIntake')}
                                    {(!appSettings?.isRegistrationOpen || !appSettings?.isFemaleRegistrationOpen) && <span className="ml-2 rounded text-[10px] bg-red-100 text-red-600 px-1 py-0.5 uppercase font-bold">{t('closed')}</span>}
                                </Link>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
            {user ? (
              <Link to="/admin" className="flex items-center text-sm font-medium text-brand-green hover:text-brand-green-light">
                <LayoutDashboard className="h-4 w-4 mr-1" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-brand-green">
                {t('staffLogin')}
              </Link>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-600">
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white pb-8 px-2 animate-in slide-in-from-top-4 duration-300 shadow-inner">
            <nav className="flex flex-col space-y-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <button 
                        onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                        className="flex items-center justify-center p-3 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:text-brand-green"
                    >
                        <Globe className="h-4 w-4 mr-2" />
                        <span>{langs[language].nativeName}</span>
                    </button>
                    <a 
                        href={content?.officialSiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center justify-center p-3 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:text-brand-green"
                    >
                        <span>{t('officialSite')}</span>
                        <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                </div>

                {langDropdownOpen && (
                    <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm animate-in fade-in duration-200">
                        {(Object.keys(langs) as Array<keyof typeof langs>).map((langKey) => (
                            <button 
                                key={langKey}
                                onClick={() => { handleLangChange(langKey); setLangDropdownOpen(false); }}
                                className={`px-4 py-2 text-xs text-center rounded-md ${language === langKey ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-700'}`}
                            >
                                {langs[langKey].nativeName}
                            </button>
                        ))}
                    </div>
                )}

                <Link to="/manage-booking" className="flex items-center bg-gray-50 p-4 rounded-lg text-sm font-medium text-gray-700 hover:text-brand-green" onClick={() => setIsMenuOpen(false)}>
                    <UserCircle className="h-5 w-5 mr-3 text-brand-green" />
                    <span>{t('manageBooking')}</span>
                </Link>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase px-4">{t('bookAssessment')}</p>
                    <div className="grid grid-cols-2 gap-2">
                        <Link 
                            to="/enroll" 
                            state={{ gender: Gender.Male }} 
                            onClick={(e) => { handleRegistrationClick(e, Gender.Male); setIsMenuOpen(false); }} 
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                (appSettings?.isRegistrationOpen && appSettings?.isMaleRegistrationOpen)
                                ? 'border-brand-green/20 bg-brand-green/5 text-brand-green font-bold'
                                : 'border-gray-100 bg-gray-50 text-gray-400'
                            }`}
                        >
                            <span>{t('maleIntake')}</span>
                            {(!appSettings?.isRegistrationOpen || !appSettings?.isMaleRegistrationOpen) && <span className="mt-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase font-black">{t('closed')}</span>}
                        </Link>
                        <Link 
                            to="/enroll" 
                            state={{ gender: Gender.Female }} 
                            onClick={(e) => { handleRegistrationClick(e, Gender.Female); setIsMenuOpen(false); }} 
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                (appSettings?.isRegistrationOpen && appSettings?.isFemaleRegistrationOpen)
                                ? 'border-brand-yellow/30 bg-brand-yellow/5 text-brand-yellow-dark font-bold'
                                : 'border-gray-100 bg-gray-50 text-gray-400'
                            }`}
                        >
                            <span>{t('femaleIntake')}</span>
                            {(!appSettings?.isRegistrationOpen || !appSettings?.isFemaleRegistrationOpen) && <span className="mt-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase font-black">{t('closed')}</span>}
                        </Link>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    {user ? (
                    <Link to="/admin" className="flex items-center justify-between w-full p-4 bg-brand-green/10 text-brand-green rounded-lg font-bold" onClick={() => setIsMenuOpen(false)}>
                        <div className="flex items-center">
                            <LayoutDashboard className="h-5 w-5 mr-3" />
                            <span>Dashboard</span>
                        </div>
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                    </Link>
                    ) : (
                    <Link to="/login" className="flex items-center justify-between w-full p-4 bg-gray-50 text-gray-700 rounded-lg font-medium" onClick={() => setIsMenuOpen(false)}>
                        <span>{t('staffLogin')}</span>
                        <ChevronDown className="h-4 w-4 -rotate-90 text-gray-300" />
                    </Link>
                    )}
                </div>
            </nav>
          </div>
        )}
      </div>

      {/* Registration Closed Modal */}
      {closedModal?.isOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-md" onClick={() => setClosedModal(null)}>
                <div 
                    className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl relative animate-in zoom-in duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-center">
                        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                            {language === 'ar' ? 'التسجيل مغلق' : 'Access Denied'}
                        </h3>
                        <div className="h-1 w-12 bg-red-500 mx-auto mb-6 rounded-full"></div>
                        <div className="text-gray-600 leading-relaxed font-medium mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {getClosedMessage(closedModal.gender)}
                        </div>
                        <button 
                            onClick={() => setClosedModal(null)}
                            className="w-full bg-brand-green text-white font-black py-4 rounded-xl shadow-lg hover:shadow-brand-green/20 hover:bg-brand-green-dark transition-all transform active:scale-95 uppercase tracking-widest text-sm"
                        >
                            {language === 'ar' ? 'فهمت' : 'I Understand'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </header>
  );
};

export default Header;