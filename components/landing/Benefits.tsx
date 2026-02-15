
import React from 'react';
import { Smartphone, FileText, Zap } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const Benefits: React.FC = () => {
    const { t } = useTranslation();

    const benefitsData = [
        {
          icon: <Smartphone className="h-8 w-8 text-brand-green" />,
          title: t('benefit1Title'),
          description: t('benefit1Desc'),
        },
        {
          icon: <FileText className="h-8 w-8 text-brand-green" />,
          title: t('benefit2Title'),
          description: t('benefit2Desc'),
        },
        {
          icon: <Zap className="h-8 w-8 text-brand-green" />,
          title: t('benefit3Title'),
          description: t('benefit3Desc'),
        },
      ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('digitalIntakeBenefits')}</h2>
        <p className="text-lg text-gray-600 mb-12 max-w-3xl mx-auto">
            {t('benefitsDescription')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefitsData.map((benefit, index) => (
            <div key={index} className="bg-slate-50/70 p-8 rounded-xl shadow-sm text-left rtl:text-right">
              <div className="mb-4 inline-block p-3 bg-green-100 rounded-lg">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
