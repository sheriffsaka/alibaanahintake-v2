
import React from 'react';
import { Link } from 'react-router-dom';
import AlIbaanahLogo from './AlIbaanahLogo';
import { useTranslation } from '../../i18n/LanguageContext';

const Footer: React.FC = () => {
    const { t } = useTranslation();
  return (
    <footer className="bg-brand-green-dark">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left">
          <div className="mb-4 sm:mb-0">
             <Link to="/" className="flex items-center justify-center sm:justify-start">
              <AlIbaanahLogo className="h-12 w-auto" />
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} {t('copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
