import React, { useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { EnrollmentState, EnrollmentAction, Gender } from '../types';
import RegistrationForm from '../components/enrollment/RegistrationForm';
import EmailVerification from '../components/enrollment/EmailVerification';
import SlotPicker from '../components/enrollment/SlotPicker';
import ConfirmationPage from '../components/enrollment/ConfirmationPage';
import { EnrollmentContext } from '../contexts/EnrollmentContext';

const STORAGE_KEY = 'al_ibaanah_enrollment_state';

const getInitialState = (gender: Gender, levelId: string = ''): EnrollmentState => {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      // Only resume if it's not a confirmed registration and not too old (e.g. 2 hours)
      // AND the gender matches the preselected one (if any)
      const isRecent = Date.now() - (parsed.timestamp || 0) < 2 * 60 * 60 * 1000;
      if (isRecent && !parsed.confirmedRegistration && parsed.formData.gender === gender) {
        return { ...parsed, step: parsed.step || 1 };
      }
    } catch (e) {
      console.error("Failed to parse saved enrollment state", e);
    }
  }

  return {
    step: 1,
    formData: {
      surname: '',
      firstname: '',
      othername: '',
      whatsappCountryCode: '+20',
      whatsapp: '',
      email: '',
      gender: gender,
      buildingNumber: '',
      flatNumber: '',
      streetName: '',
      district: '',
      state: '',
      address: '',
      levelId: levelId,
      language: 'en',
    },
    isEmailVerified: false,
  };
};

const enrollmentReducer = (state: EnrollmentState, action: EnrollmentAction): EnrollmentState => {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'PREV_STEP':
      return { ...state, step: state.step - 1 };
    case 'UPDATE_FORM':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'SET_EMAIL_VERIFIED':
      return { ...state, isEmailVerified: action.payload };
    case 'SELECT_SLOT':
        return { 
            ...state, 
            selectedSlotId: action.payload.id,
            selectedSlotDate: action.payload.date,
            step: state.step + 1
        };
    case 'CONFIRM_REGISTRATION':
        return { ...state, confirmedRegistration: action.payload };
    case 'RESET':
        return getInitialState(action.payload?.gender || state.formData.gender, action.payload?.levelId || state.formData.levelId);
    default:
      return state;
  }
};

const EnrollmentPage: React.FC = () => {
  const location = useLocation();
  const preselectedGender = location.state?.gender === Gender.Female ? Gender.Female : Gender.Male;
  const preselectedLevelId = location.state?.levelId || '';
  
  const [state, dispatch] = useReducer(enrollmentReducer, getInitialState(preselectedGender, preselectedLevelId));

  // Reset if preselected gender changes (e.g. user goes back and picks different intake)
  React.useEffect(() => {
    if (state.formData.gender !== preselectedGender) {
      dispatch({ type: 'RESET', payload: { gender: preselectedGender, levelId: preselectedLevelId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedGender]);

  // Persist state to localStorage
  React.useEffect(() => {
    if (state.confirmedRegistration) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
    }
  }, [state]);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <RegistrationForm />;
      case 2:
        return <EmailVerification />;
      case 3:
        return <SlotPicker />;
      case 4:
        return <ConfirmationPage />;
      default:
        return <RegistrationForm />;
    }
  };

  return (
    <EnrollmentContext.Provider value={{ state, dispatch }}>
      <div className="min-h-[calc(100vh-5rem)] bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl p-8">
            {renderStep()}
        </div>
      </div>
    </EnrollmentContext.Provider>
  );
};

export default EnrollmentPage;