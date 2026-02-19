import React, { useContext, useState, useEffect } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import { Gender, Level } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { getLevels } from '../../services/apiService';
import { User, Mail, Phone, Home, Users } from 'lucide-react';

const RegistrationForm: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { state, dispatch } = context;
  const [errors, setErrors] = useState<Partial<typeof state.formData>>({});
  const [levels, setLevels] = useState<Level[]>([]);

  useEffect(() => {
    const fetchLevels = async () => {
        const activeLevels = await getLevels();
        setLevels(activeLevels);
        // Set a default level if none is selected
        if (!state.formData.levelId && activeLevels.length > 0) {
            dispatch({ type: 'UPDATE_FORM', payload: { levelId: activeLevels[0].id } });
        }
    };
    fetchLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Select label="Level Registering For" name="levelId" value={state.formData.levelId} onChange={handleChange} options={levels.map(l => ({ value: l.id, label: l.name }))} />
      <div className="pt-4">
        <Button type="submit" fullWidth>Next: Book Appointment Slot</Button>
      </div>
    </form>
  );
};

export default RegistrationForm;