
import React, { useContext, useState } from 'react';
import { EnrollmentContext } from '../../pages/EnrollmentPage';
import { Gender, Level } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { LEVELS } from '../../constants';
import { User, Mail, Phone, Home, BookOpen, Calendar, Paperclip, Users } from 'lucide-react';

const RegistrationForm: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { state, dispatch } = context;
  const [errors, setErrors] = useState<Partial<typeof state.formData>>({});

  const validate = () => {
    const newErrors: Partial<typeof state.formData> = {};
    if (!state.formData.firstname) newErrors.firstname = 'First name is required';
    if (!state.formData.surname) newErrors.surname = 'Surname is required';
    if (!state.formData.whatsapp) newErrors.whatsapp = 'WhatsApp number is required';
    if (!state.formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(state.formData.email)) newErrors.email = 'Email is invalid';
    if (!state.formData.address) newErrors.address = 'Home address is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      dispatch({ type: 'NEXT_STEP' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    dispatch({ type: 'UPDATE_FORM', payload: { [e.target.name]: e.target.value } });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      dispatch({ type: 'UPDATE_FORM', payload: { document: e.target.files[0] } });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Step 1: Digital Registration ({state.formData.gender})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Surname" name="surname" value={state.formData.surname} onChange={handleChange} error={errors.surname} icon={<User className="h-4 w-4 text-gray-400" />} required />
        <Input label="First Name" name="firstname" value={state.formData.firstname} onChange={handleChange} error={errors.firstname} icon={<User className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label="Other Name (Optional)" name="othername" value={state.formData.othername} onChange={handleChange} icon={<User className="h-4 w-4 text-gray-400" />} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="WhatsApp Phone Number" name="whatsapp" type="tel" value={state.formData.whatsapp} onChange={handleChange} error={errors.whatsapp} icon={<Phone className="h-4 w-4 text-gray-400" />} required />
        <Input label="Email Address" name="email" type="email" value={state.formData.email} onChange={handleChange} error={errors.email} icon={<Mail className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label="Gender" name="gender" value={state.formData.gender} icon={<Users className="h-4 w-4 text-gray-400" />} readOnly disabled className="bg-gray-100 cursor-not-allowed" />
      <Input label="Home Address in Egypt" name="address" value={state.formData.address} onChange={handleChange} error={errors.address} icon={<Home className="h-4 w-4 text-gray-400" />} required />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Level Registering For" name="level" value={state.formData.level} onChange={handleChange} options={LEVELS.map(l => ({ value: l, label: l }))} />
        <Input label="Preferred Intake Date" name="intakeDate" type="date" value={state.formData.intakeDate} onChange={handleChange} icon={<Calendar className="h-4 w-4 text-gray-400" />} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Optional Document Upload</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
                <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                        <span>Upload a file</span>
                        <input id="file-upload" name="document" type="file" className="sr-only" onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                {state.formData.document && <p className="text-sm text-green-600 mt-2">{state.formData.document.name}</p>}
            </div>
        </div>
      </div>
      <div className="pt-4">
        <Button type="submit" fullWidth>Next: Book Appointment Slot</Button>
      </div>
    </form>
  );
};

export default RegistrationForm;
