import React, { useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { EnrollmentState, EnrollmentAction, Gender } from '../types';
import RegistrationForm from '../components/enrollment/RegistrationForm';
import SlotPicker from '../components/enrollment/SlotPicker';
import ConfirmationPage from '../components/enrollment/ConfirmationPage';
import { EnrollmentContext } from '../contexts/EnrollmentContext';

const getInitialState = (gender: Gender): EnrollmentState => ({
  step: 1,
  formData: {
    surname: '',
    firstname: '',
    othername: '',
    whatsappCountryCode: '+20',
    whatsapp: '',
    email: '',
    gender: gender,
    address: '',
    levelId: '',
  },
});

const enrollmentReducer = (state: EnrollmentState, action: EnrollmentAction): EnrollmentState => {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'PREV_STEP':
      return { ...state, step: state.step - 1 };
    case 'UPDATE_FORM':
      return { ...state, formData: { ...state.formData, ...action.payload } };
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
        return getInitialState(state.formData.gender);
    default:
      return state;
  }
};

const EnrollmentPage: React.FC = () => {
  const location = useLocation();
  const preselectedGender = location.state?.gender === Gender.Female ? Gender.Female : Gender.Male;
  
  const [state, dispatch] = useReducer(enrollmentReducer, getInitialState(preselectedGender));

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <RegistrationForm />;
      case 2:
        return <SlotPicker />;
      case 3:
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