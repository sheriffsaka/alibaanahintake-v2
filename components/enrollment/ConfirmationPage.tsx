import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import { submitRegistration } from '../../services/apiService';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import AdmissionSlip from './AdmissionSlip';
import { CheckCircle, Download, Printer, Home } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const ConfirmationPage: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { t } = useTranslation();
  const { state, dispatch } = context;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const slipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const processRegistration = async () => {
      if (state.confirmedRegistration || !state.selectedSlotId || !state.selectedSlotDate) {
          setLoading(false);
          return;
      };

      setLoading(true);
      setError(null);
      try {
        const registrationData = {
          ...state.formData,
          intakeDate: state.selectedSlotDate,
          appointmentSlotId: state.selectedSlotId,
        };
        const newStudent = await submitRegistration(registrationData);
        dispatch({ type: 'CONFIRM_REGISTRATION', payload: newStudent });
      } catch (err) {
        setError(t('bookingFailedMessage'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    processRegistration();
    
  }, [dispatch, state.confirmedRegistration, state.formData, state.selectedSlotDate, state.selectedSlotId, t]);

  const handleBackToPortal = () => {
      dispatch({ type: 'RESET' });
      navigate('/');
  }

  const handleDownloadImage = () => {
    if (slipRef.current) {
        html2canvas(slipRef.current, { scale: 2 }).then(canvas => { // Increased scale for better quality
            const link = document.createElement('a');
            link.download = `Al-Ibaanah-Admission-Slip-${state.confirmedRegistration?.registrationCode}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('confirmingRegistrationTitle')}</h2>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <h2 className="text-2xl font-semibold mb-4">{t('bookingFailedTitle')}</h2>
        <p>{error}</p>
        <div className="mt-6">
            <Button onClick={() => dispatch({ type: 'PREV_STEP' })}>{t('goBackButton')}</Button>
        </div>
      </div>
    );
  }

  if (!state.confirmedRegistration) {
    return <div className="text-center">{t('somethingWentWrong')}</div>;
  }
  
  return (
    <div>
        <div className="text-center mb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800">{t('registrationSuccessTitle')}</h2>
            <p className="text-gray-600 mt-2">{t('registrationSuccessMessage')}</p>
        </div>

        <div id="admission-slip-printable" ref={slipRef} className="bg-white">
            <AdmissionSlip student={state.confirmedRegistration} />
        </div>
        
        <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button onClick={handleDownloadImage} variant="secondary" className="flex items-center"><Download className="h-4 w-4 mr-2"/>{t('downloadButton')}</Button>
            <Button onClick={handlePrint} variant="secondary" className="flex items-center"><Printer className="h-4 w-4 mr-2"/>{t('printButton')}</Button>
            <Button onClick={handleBackToPortal} className="flex items-center"><Home className="h-4 w-4 mr-2"/>{t('backToPortalButton')}</Button>
        </div>
    </div>
  );
};

export default ConfirmationPage;