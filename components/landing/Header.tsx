
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AlIbaanahLogo from './AlIbaanahLogo';
import { ChevronDown, ExternalLink, Globe } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { langs } from '../../i18n/locales';
import { Gender } from '../../types';
import { useSiteContent } from '../../contexts/SiteContentContext';

const Header: React.FC = () => {
  const { t, changeLanguage, language } = useTranslation();
  const { content } = useSiteContent();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);

  const handleLangChange = (langKey: keyof typeof langs) => {
    changeLanguage(langKey);
    setLangDropdownOpen(false);
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
          <nav className="hidden md:flex items-center space-x-6">
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
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10">
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
            <div className="relative">
                <button 
                    onClick={() => setBookingDropdownOpen(!bookingDropdownOpen)}
                    onBlur={() => setTimeout(() => setBookingDropdownOpen(false), 150)}
                    className="bg-brand-green text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-brand-green-light transition-colors flex items-center"
                >
                    {t('bookAssessment')}
                    <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                {bookingDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border">
                        <ul className="py-1">
                            <li>
                                <Link to="/enroll" state={{ gender: Gender.Male }} onClick={() => setBookingDropdownOpen(false)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('maleIntake')}</Link>
                            </li>
                            <li>
                                <Link to="/enroll" state={{ gender: Gender.Female }} onClick={() => setBookingDropdownOpen(false)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('femaleIntake')}</Link>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-brand-green">
              {t('staffLogin')}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
