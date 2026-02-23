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
  { code: '+34', label: 'Spain (+34)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+7', label: 'Russia (+7)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+64', label: 'New Zealand (+64)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+55', label: 'Brazil (+55)' },
  { code: '+52', label: 'Mexico (+52)' },
  { code: '+54', label: 'Argentina (+54)' },
  { code: '+57', label: 'Colombia (+57)' },
  { code: '+51', label: 'Peru (+51)' },
  { code: '+56', label: 'Chile (+56)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+251', label: 'Ethiopia (+251)' },
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+256', label: 'Uganda (+256)' },
  { code: '+231', label: 'Liberia (+231)' },
  { code: '+232', label: 'Sierra Leone (+232)' },
  { code: '+220', label: 'Gambia (+220)' },
  { code: '+221', label: 'Senegal (+221)' },
  { code: '+225', label: 'Ivory Coast (+225)' },
  { code: '+237', label: 'Cameroon (+237)' },
  { code: '+241', label: 'Gabon (+241)' },
  { code: '+242', label: 'Congo (+242)' },
  { code: '+243', label: 'DR Congo (+243)' },
  { code: '+244', label: 'Angola (+244)' },
  { code: '+260', label: 'Zambia (+260)' },
  { code: '+263', label: 'Zimbabwe (+263)' },
  { code: '+264', label: 'Namibia (+264)' },
  { code: '+265', label: 'Malawi (+265)' },
  { code: '+267', label: 'Botswana (+267)' },
  { code: '+268', label: 'Eswatini (+268)' },
  { code: '+266', label: 'Lesotho (+266)' },
  { code: '+230', label: 'Mauritius (+230)' },
  { code: '+248', label: 'Seychelles (+248)' },
  { code: '+262', label: 'Reunion (+262)' },
  { code: '+261', label: 'Madagascar (+261)' },
  { code: '+252', label: 'Somalia (+252)' },
  { code: '+253', label: 'Djibouti (+253)' },
  { code: '+291', label: 'Eritrea (+291)' },
  { code: '+218', label: 'Libya (+218)' },
  { code: '+222', label: 'Mauritania (+222)' },
  { code: '+223', label: 'Mali (+223)' },
  { code: '+224', label: 'Guinea (+224)' },
  { code: '+226', label: 'Burkina Faso (+226)' },
  { code: '+227', label: 'Niger (+227)' },
  { code: '+228', label: 'Togo (+228)' },
  { code: '+229', label: 'Benin (+229)' },
  { code: '+235', label: 'Chad (+235)' },
  { code: '+236', label: 'Central African Rep (+236)' },
  { code: '+238', label: 'Cape Verde (+238)' },
  { code: '+239', label: 'Sao Tome & Principe (+239)' },
  { code: '+240', label: 'Equatorial Guinea (+240)' },
  { code: '+245', label: 'Guinea-Bissau (+245)' },
  { code: '+246', label: 'Diego Garcia (+246)' },
  { code: '+247', label: 'Ascension Island (+247)' },
  { code: '+250', label: 'Rwanda (+250)' },
  { code: '+257', label: 'Burundi (+257)' },
  { code: '+258', label: 'Mozambique (+258)' },
  { code: '+269', label: 'Comoros (+269)' },
  { code: '+290', label: 'Saint Helena (+290)' },
  { code: '+297', label: 'Aruba (+297)' },
  { code: '+298', label: 'Faroe Islands (+298)' },
  { code: '+299', label: 'Greenland (+299)' },
  { code: '+350', label: 'Gibraltar (+350)' },
  { code: '+351', label: 'Portugal (+351)' },
  { code: '+352', label: 'Luxembourg (+352)' },
  { code: '+353', label: 'Ireland (+353)' },
  { code: '+354', label: 'Iceland (+354)' },
  { code: '+355', label: 'Albania (+355)' },
  { code: '+356', label: 'Malta (+356)' },
  { code: '+357', label: 'Cyprus (+357)' },
  { code: '+358', label: 'Finland (+358)' },
  { code: '+359', label: 'Bulgaria (+359)' },
  { code: '+370', label: 'Lithuania (+370)' },
  { code: '+371', label: 'Latvia (+371)' },
  { code: '+372', label: 'Estonia (+372)' },
  { code: '+373', label: 'Moldova (+373)' },
  { code: '+374', label: 'Armenia (+374)' },
  { code: '+375', label: 'Belarus (+375)' },
  { code: '+376', label: 'Andorra (+376)' },
  { code: '+377', label: 'Monaco (+377)' },
  { code: '+378', label: 'San Marino (+378)' },
  { code: '+380', label: 'Ukraine (+380)' },
  { code: '+381', label: 'Serbia (+381)' },
  { code: '+382', label: 'Montenegro (+382)' },
  { code: '+383', label: 'Kosovo (+383)' },
  { code: '+385', label: 'Croatia (+385)' },
  { code: '+386', label: 'Slovenia (+386)' },
  { code: '+387', label: 'Bosnia & Herzegovina (+387)' },
  { code: '+389', label: 'North Macedonia (+389)' },
  { code: '+420', label: 'Czech Republic (+420)' },
  { code: '+421', label: 'Slovakia (+421)' },
  { code: '+423', label: 'Liechtenstein (+423)' },
  { code: '+992', label: 'Tajikistan (+992)' },
  { code: '+993', label: 'Turkmenistan (+993)' },
  { code: '+994', label: 'Azerbaijan (+994)' },
  { code: '+995', label: 'Georgia (+995)' },
  { code: '+996', label: 'Kyrgyzstan (+996)' },
  { code: '+998', label: 'Uzbekistan (+998)' },
].sort((a, b) => a.label.localeCompare(b.label));

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
    
    if (!state.formData.buildingNumber) newErrors.buildingNumber = t('errorBuildingRequired');
    if (!state.formData.streetName) newErrors.streetName = t('errorStreetRequired');
    if (!state.formData.district) newErrors.district = t('errorDistrictRequired');
    if (!state.formData.state) newErrors.state = t('errorStateRequired');
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      // Concatenate address for display purposes in confirmation/slip
      const fullAddress = `${state.formData.buildingNumber}${state.formData.flatNumber ? ', Flat ' + state.formData.flatNumber : ''}, ${state.formData.streetName}, ${state.formData.district}, ${state.formData.state}`;
      dispatch({ type: 'UPDATE_FORM', payload: { address: fullAddress } as any });
      dispatch({ type: 'NEXT_STEP' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    dispatch({ type: 'UPDATE_FORM', payload: { [e.target.name]: e.target.value } });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">{t('step1Title', { gender: state.formData.gender })}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
        <Input label={t('surnameLabel')} name="surname" value={state.formData.surname} onChange={handleChange} error={errors.surname} icon={<User className="h-4 w-4 text-gray-400" />} required />
        <Input label={t('firstnameLabel')} name="firstname" value={state.formData.firstname} onChange={handleChange} error={errors.firstname} icon={<User className="h-4 w-4 text-gray-400" />} required />
      </div>
      <Input label={t('othernameLabel')} name="othername" value={state.formData.othername} onChange={handleChange} icon={<User className="h-4 w-4 text-gray-400" />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Phone className="h-4 w-4 mr-2 text-gray-400" />
            {t('whatsappLabel')} <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex gap-2">
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
      
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 flex items-center">
            <Home className="h-4 w-4 mr-2 text-gray-400" />
            {t('addressLabel')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label={t('buildingNumberLabel')} name="buildingNumber" value={state.formData.buildingNumber} onChange={handleChange} error={errors.buildingNumber} placeholder="e.g. 12" required />
            <Input label={t('flatNumberLabel')} name="flatNumber" value={state.formData.flatNumber} onChange={handleChange} placeholder="e.g. 4B" />
            <div className="col-span-2">
                <Input label={t('streetNameLabel')} name="streetName" value={state.formData.streetName} onChange={handleChange} error={errors.streetName} placeholder="e.g. Al-Nasr St" required />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('districtLabel')} name="district" value={state.formData.district} onChange={handleChange} error={errors.district} placeholder="e.g. Nasr City" required />
            <Input label={t('stateLabel')} name="state" value={state.formData.state} onChange={handleChange} error={errors.state} placeholder="e.g. Cairo" required />
        </div>
      </div>

      <Select label={t('levelLabel')} name="levelId" value={state.formData.levelId} onChange={handleChange} options={levels.map(l => ({ value: l.id, label: l.name }))} />
      <div className="pt-4">
        <Button type="submit" fullWidth>{t('nextButton')}</Button>
      </div>
    </form>
  );
};

export default RegistrationForm;