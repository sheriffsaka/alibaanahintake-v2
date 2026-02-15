
import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { EnrollmentContext } from '../../pages/EnrollmentPage';
import { submitRegistration } from '../../services/mockApiService';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import AdmissionSlip from './AdmissionSlip';
import { WHAT_TO_BRING } from '../../constants';
import { CheckCircle, Download, Printer, Home } from 'lucide-react';

const ConfirmationPage: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");

  const { state, dispatch } = context;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const slipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const processRegistration = async () => {
      if (state.confirmedRegistration || !state.selectedSlotId) {
          setLoading(false);
          return;
      };

      setLoading(true);
      setError(null);
      try {
        const registrationData = {
          ...state.formData,
          appointmentSlotId: state.selectedSlotId,
        };
        const newStudent = await submitRegistration(registrationData);
        dispatch({ type: 'CONFIRM_REGISTRATION', payload: newStudent });
      } catch (err) {
        setError("Failed to book appointment. The slot may have been filled. Please go back and try another slot.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    processRegistration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackToPortal = () => {
      dispatch({ type: 'RESET' });
      navigate('/');
  }

  const handleDownloadImage = () => {
    if (slipRef.current) {
        html2canvas(slipRef.current).then(canvas => {
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
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Confirming your registration...</h2>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <h2 className="text-2xl font-semibold mb-4">Booking Failed</h2>
        <p>{error}</p>
        <div className="mt-6">
            <Button onClick={() => dispatch({ type: 'PREV_STEP' })}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!state.confirmedRegistration) {
    return <div className="text-center">Something went wrong. Please start over.</div>;
  }
  
  return (
    <div>
        <div className="text-center mb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800">Registration Successful!</h2>
            <p className="text-gray-600 mt-2">Your appointment is confirmed. Please see your admission slip below.</p>
        </div>

        <div id="admission-slip-printable" ref={slipRef}>
            <AdmissionSlip student={state.confirmedRegistration} />
        </div>

        <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">What to Bring</h3>
            <ul className="space-y-3">
                {WHAT_TO_BRING.map((item, index) => (
                    <li key={index} className="flex items-start p-3 bg-gray-50 rounded-md">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                        <div>
                            <span className="font-semibold">{item.item}:</span>
                            <span className="text-gray-600 ml-2">{item.detail}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
        
        <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button onClick={handleDownloadImage} variant="secondary" className="flex items-center"><Download className="h-4 w-4 mr-2"/>Download as Image</Button>
            <Button onClick={handlePrint} variant="secondary" className="flex items-center"><Printer className="h-4 w-4 mr-2"/>Print / Save PDF</Button>
            <Button onClick={handleBackToPortal} className="flex items-center"><Home className="h-4 w-4 mr-2"/>Back to Portal</Button>
        </div>
    </div>
  );
};

export default ConfirmationPage;
