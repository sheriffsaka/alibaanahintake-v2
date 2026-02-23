import React, { useContext, useState, useEffect } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import { Level } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { getLevels } from '../../services/apiService';
import { User, Mail, Phone, Home, Users } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const COUNTRY_CODES = [
  { code: '+20', label: 'Egypt (+20)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+234', label: 'Nigeria (+234)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+1', label: 'USA/Canada (+1)' },
  { code: '+233', label: 'Ghana (+233)' },
  { code: '+212', label: 'Morocco (+212)' },
  { code: '+213', label: 'Algeria (+213)' },
  { code: '+216', label: 'Tunisia (+216)' },
  { code: '+249', label: 'Sudan (+249)' },
  { code: '+962', label: 'Jordan (+962)' },
  { code: '+961', label: 'Lebanon (+961)' },
  { code: '+965', label: 'Kuwait (+965)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+973', label: 'Bahrain (+973)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+90', label: 'Turkey (+90)' },
  { code: '+60', label: 'Malaysia (+60)' },
  { code: '+62', label: 'Indonesia (+62)' },
  { code: '+92', label: 'Pakistan (+92)' },
  { code: '+880', label: 'Bangladesh (+880)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+49', label: 'Germany (+49)' },
];

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">{t('step1Title', { gender: state.formData.gender })}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <Input label={t('surnameLabel')} name="surname" value={state.formData.surname} onChange={handleChange} error={errors.surname} icon={<User className="h-4 w-4 text-gray-400" />} required />
        <Input label={t('firstnameLabel')} name="firstname" value={state.formData.firstname} onChange={handleChange} error={errors.firstname} icon={<User className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label={t('othernameLabel')} name="othername" value={state.formData.othername} onChange={handleChange} icon={<User className="h-4 w-4 text-gray-400" />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Phone className="h-4 w-4 mr-2 text-gray-400" />
            {t('whatsappLabel')} <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex gap-4">
            <select
              name="whatsappCountryCode"
              value={state.formData.whatsappCountryCode}
              onChange={handleChange}
              className="w-32 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input
              type="tel"
              name="whatsapp"
              value={state.formData.whatsapp}
              onChange={handleChange}
              placeholder="123456789"
              className={`flex-1 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm ${errors.whatsapp ? 'border-red-500' : 'border-gray-300'}`}
              required
            />
          </div>
          {errors.whatsapp && <p className="mt-1 text-xs text-red-500">{errors.whatsapp}</p>}
        </div>
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