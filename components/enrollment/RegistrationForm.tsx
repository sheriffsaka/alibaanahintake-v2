import React, { useContext, useState, useEffect } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import { Level } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { getLevels } from '../../services/apiService';
import { User, Mail, Phone, Home, Users } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const RegistrationForm: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");
  
  const { t } = useTranslation();
  const { state, dispatch } = context;
  const [errors, setErrors] = useState<Partial<typeof state.formData>>({});
  const [levels, setLevels] = useState<Level[]>([]);

  useEffect(() => {
    const fetchLevels = async () => {
        const activeLevels = await getLevels();
        setLevels(activeLevels);
        if (!state.formData.levelId && activeLevels.length > 0) {
            dispatch({ type: 'UPDATE_FORM', payload: { levelId: activeLevels[0].id } });
        }
    };
    fetchLevels();
    
  }, [dispatch, state.formData.levelId]);

  const validate = () => {
    const newErrors: Partial<typeof state.formData> = {};
    if (!state.formData.firstname) newErrors.firstname = t('errorFirstnameRequired');
    if (!state.formData.surname) newErrors.surname = t('errorSurnameRequired');
    if (!state.formData.whatsapp) newErrors.whatsapp = t('errorWhatsappRequired');
    if (!state.formData.email) newErrors.email = t('errorEmailRequired');
    else if (!/\S+@\S+\.\S+/.test(state.formData.email)) newErrors.email = t('errorEmailInvalid');
    if (!state.formData.address) newErrors.address = t('errorAddressRequired');
    
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
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">{t('step1Title', { gender: state.formData.gender })}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('surnameLabel')} name="surname" value={state.formData.surname} onChange={handleChange} error={errors.surname} icon={<User className="h-4 w-4 text-gray-400" />} required />
        <Input label={t('firstnameLabel')} name="firstname" value={state.formData.firstname} onChange={handleChange} error={errors.firstname} icon={<User className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label={t('othernameLabel')} name="othername" value={state.formData.othername} onChange={handleChange} icon={<User className="h-4 w-4 text-gray-400" />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('whatsappLabel')} name="whatsapp" type="tel" value={state.formData.whatsapp} onChange={handleChange} error={errors.whatsapp} icon={<Phone className="h-4 w-4 text-gray-400" />} required />
        <Input label={t('emailLabel')} name="email" type="email" value={state.formData.email} onChange={handleChange} error={errors.email} icon={<Mail className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label={t('genderLabel')} name="gender" value={state.formData.gender} icon={<Users className="h-4 w-4 text-gray-400" />} readOnly disabled className="bg-gray-100 cursor-not-allowed" />
      <Input label={t('addressLabel')} name="address" value={state.formData.address} onChange={handleChange} error={errors.address} icon={<Home className="h-4 w-4 text-gray-400" />} required />
      <Select label={t('levelLabel')} name="levelId" value={state.formData.levelId} onChange={handleChange} options={levels.map(l => ({ value: l.id, label: l.name }))} />
      <div className="pt-4">
        <Button type="submit" fullWidth>{t('nextButton')}</Button>
      </div>
    </form>
  );
};

export default RegistrationForm;