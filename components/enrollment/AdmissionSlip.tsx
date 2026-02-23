import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { getScheduleById } from '../../services/apiService';
import AlIbaanahLogo from '../landing/AlIbaanahLogo';
import { MANDATORY_REQUIREMENTS } from '../../constants';
import { CheckCircle, ListChecks } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { useSiteContent } from '../../contexts/SiteContentContext';

interface AdmissionSlipProps {
  student: Student;
}

const AdmissionSlip: React.FC<AdmissionSlipProps> = ({ student }) => {
  const { t, language } = useTranslation();
  const { content } = useSiteContent();
  const [appointmentTime, setAppointmentTime] = useState('');
  

  useEffect(() => {
    const fetchSlotTime = async () => {
      if (!student.appointmentSlotId) return;
      const studentSlot = await getScheduleById(student.appointmentSlotId);
      if (studentSlot) {
        
        setAppointmentTime(`${studentSlot.startTime} - ${studentSlot.endTime}`);
      }
    };
    fetchSlotTime();
  }, [student.appointmentSlotId]);

  const appointmentDate = new Date(student.intakeDate);

  const displayAddress = student.buildingNumber 
    ? `${student.buildingNumber}${student.flatNumber ? ', Flat ' + student.flatNumber : ''}, ${student.streetName}, ${student.district}, ${student.state}`
    : student.address;

  return (
    <div className="bg-white font-sans p-6 md:p-8 max-w-4xl mx-auto border rounded-lg">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b">
        <div className="flex items-center">
            <AlIbaanahLogo className="h-16 w-auto" logoUrl={content?.logoUrl} />
        </div>
        <div className="text-center sm:text-left mt-4 sm:mt-0 sm:mx-4">
            <h2 className="text-xl font-bold text-brand-green-dark">AL-IBAANAH ARABIC CENTER</h2>
            <p className="text-sm text-gray-500 tracking-widest">{t('admissionSlipTitle')}</p>
        </div>
        <div className="bg-gray-100 rounded-lg p-3 text-center mt-4 sm:mt-0">
            <p className="text-xs text-gray-500 font-bold">{t('registrationIdLabel')}</p>
            <p className="font-mono font-bold text-lg text-red-700">{student.registrationCode.replace('AI-', 'AIB-2026-')}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Student Details */}
        <div className="md:col-span-2 space-y-6 relative">
             <div className="absolute inset-0 flex items-center justify-center z-0">
                <AlIbaanahLogo className="h-64 w-auto text-gray-500 opacity-5" logoUrl={content?.logoUrl} />
            </div>
            <div className="relative z-10">
                <InfoItem label={t('studentInfoLabel')} value={`${student.firstname} ${student.surname}`} valueClass="text-2xl font-bold" />
                <p className="text-gray-600 -mt-2">{student.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 relative z-10">
                <InfoItem label={t('targetLevelLabel')} value={student.level?.name || 'N/A'} valueClass="text-brand-green font-semibold"/>
                <InfoItem label={t('genderLabel')} value={student.gender} valueClass="text-brand-green font-semibold"/>
            </div>
             <div className="relative z-10">
                 <InfoItem label={t('homeAddressLabel')} value={displayAddress} />
            </div>
        </div>

        {/* Right Column: Appointment Card */}
        <div className="bg-brand-green-dark text-white rounded-3xl p-6 flex flex-col items-center text-center h-full">
            <p className="text-sm font-semibold tracking-widest opacity-80">{t('confirmedAppointmentLabel')}</p>
            <div className="my-4">
                <span className="text-7xl font-bold leading-none">{appointmentDate.getDate()}</span>
                <span className="text-4xl font-semibold ml-2">{appointmentDate.toLocaleDateString(language, { month: 'short' })}</span>
            </div>
            <p className="text-lg opacity-90">{appointmentTime}</p>
            <div className="bg-white p-2 rounded-lg my-auto">
                <QRCodeSVG value={student.registrationCode} size={128} level="H" />
            </div>
            <p className="text-xs opacity-70 mt-2">{t('validityNotice')}</p>
        </div>
      </main>

      {/* Mandatory Requirements */}
      <section className="mt-10">
        <h3 className="flex items-center text-sm font-bold text-gray-700 uppercase mb-4">
            <ListChecks className="h-5 w-5 mr-2 text-brand-green"/>
            {MANDATORY_REQUIREMENTS.title}
        </h3>
        <div className="space-y-6 text-sm">
            <div>
                <h4 className="font-semibold text-gray-800 mb-2">{t('firstTimeStudentsTitle')}</h4>
                <div className="space-y-2">
                    {MANDATORY_REQUIREMENTS.firstTime.items.map((item, index) => (
                        <div key={`first-${index}`} className="bg-gray-50/70 p-3 rounded-lg flex items-start">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0"/>
                            <p className="text-gray-700">{item}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-800 mb-2">{t('returningStudentsTitle')}</h4>
                <div className="space-y-2">
                    {MANDATORY_REQUIREMENTS.returning.items.map((item, index) => (
                        <div key={`return-${index}`} className="bg-gray-50/70 p-3 rounded-lg flex items-start">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0"/>
                            <p className="text-gray-700">{item}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                 <h4 className="font-semibold text-gray-800 mb-2">{t('additionally')}</h4>
                 <div className="space-y-2">
                    {MANDATORY_REQUIREMENTS.additional.map((item, index) => (
                         <div key={`add-${index}`} className="bg-gray-50/70 p-3 rounded-lg flex items-start">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0"/>
                            <p className="text-gray-700">{item}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-gray-400 uppercase tracking-wider">
        {t('slipFooter')}
      </footer>
    </div>
  );
};

const InfoItem: React.FC<{label: string, value: string, valueClass?: string}> = ({label, value, valueClass = ''}) => (
    <div>
        <p className="text-xs text-gray-500 font-bold tracking-wider">{label}</p>
        <p className={`text-lg text-gray-800 ${valueClass}`}>{value}</p>
    </div>
);

export default AdmissionSlip;