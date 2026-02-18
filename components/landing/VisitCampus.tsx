
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { useSiteContent } from '../../contexts/SiteContentContext';

const VisitCampus: React.FC = () => {
    const { t } = useTranslation();
    const { content } = useSiteContent();
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="rtl:order-2">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('visitCampusTitle')}</h2>
            <p className="text-lg text-gray-600 mb-8">
              {t('visitCampusDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50/70 p-6 rounded-xl">
                <MapPin className="h-7 w-7 text-brand-green mb-2" />
                <h3 className="font-semibold mb-1">{t('address')}</h3>
                <p className="text-sm text-gray-600">{content?.campusAddress}</p>
              </div>
              <div className="bg-slate-50/70 p-6 rounded-xl">
                <Clock className="h-7 w-7 text-brand-green mb-2" />
                <h3 className="font-semibold mb-1">{t('operatingHours')}</h3>
                <p className="text-sm text-gray-600">{content?.campusHours}</p>
              </div>
            </div>
            <Link to="/enroll">
              <button className="bg-brand-green text-white px-8 py-3 rounded-md text-base font-semibold hover:bg-brand-green-light transition-colors">
                {t('readyToBook')}
              </button>
            </Link>
          </div>

          {/* Right Image */}
          <div className="rtl:order-1">
            <img
              src="https://res.cloudinary.com/di7okmjsx/image/upload/v1771243479/ibaanahstudents_lacwoc.jpg"
              alt="Students in a classroom at Al-Ibaanah"
              className="rounded-xl shadow-lg w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisitCampus;
