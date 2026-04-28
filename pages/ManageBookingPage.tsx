
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { Student, Level } from '../types';
import { requestManageBookingOTP, verifyManageBookingOTP, updateStudentDetails, getLevelsWithSlots } from '../services/apiService';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { Mail, CheckCircle, User, Phone, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

const ManageBookingPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState<'email' | 'otp' | 'edit' | 'success'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [student, setStudent] = useState<Student | null>(null);
    const [levels, setLevels] = useState<Level[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (student) {
            const fetchLevels = async () => {
                try {
                    const data = await getLevelsWithSlots(student.gender);
                    setLevels(data);
                } catch (err) {
                    console.error("Failed to fetch levels:", err);
                }
            };
            fetchLevels();
        }
    }, [student]);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await requestManageBookingOTP(email);
            setStep('otp');
        } catch (err: unknown) {
            const error = err as { status?: number; message?: string };
            if (error.status === 429) {
                setError("Daily email quota reached. Please retrieve the code from server logs or try again tomorrow.");
            } else {
                setError(error.message || t('somethingWentWrong'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const studentData = await verifyManageBookingOTP(email, otp);
            setStudent(studentData);
            setStep('edit');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('errorInvalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;

        setLoading(true);
        setError(null);
        try {
            const fullAddress = `${student.buildingNumber || ''}, Flat ${student.flatNumber || ''}, ${student.streetName || ''}, ${student.district || ''}, ${student.state || ''}`;
            await updateStudentDetails(student.id, {
                firstname: student.firstname,
                othername: student.othername,
                surname: student.surname,
                whatsapp: student.whatsapp,
                buildingNumber: student.buildingNumber,
                flatNumber: student.flatNumber,
                streetName: student.streetName,
                district: student.district,
                state: student.state,
                address: fullAddress,
                levelId: student.levelId
            });
            setStep('success');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('errorUpdateFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!student) return;
        setStudent({ ...student, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-brand-green uppercase tracking-tighter italic">Al-Ibaanah</h1>
                    <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mt-1">IntakeFlow Management</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-brand-green p-6 text-white text-center">
                        <h2 className="text-xl font-bold uppercase tracking-tight">
                            {step === 'success' ? t('success') : t('manageBooking')}
                        </h2>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        {step === 'email' && (
                            <form onSubmit={handleSendOTP} className="space-y-6">
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {t('manageBookingDescription')}
                                </p>
                                <Input 
                                    label={t('emailLabel')} 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    placeholder="your@email.com"
                                    icon={<Mail className="h-4 w-4" />}
                                    required 
                                />
                                <Button fullWidth loading={loading} type="submit" size="lg">
                                    {t('sendVerificationCode')}
                                </Button>
                                <button 
                                    type="button" 
                                    onClick={() => navigate('/')}
                                    className="w-full text-sm text-gray-500 font-medium hover:text-brand-green transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={16} />
                                    {t('backToPortalButton')}
                                </button>
                            </form>
                        )}

                        {step === 'otp' && (
                            <form onSubmit={handleVerifyOTP} className="space-y-6">
                                <div className="text-center mb-4">
                                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck className="h-8 w-8 text-blue-500" />
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {t('verifyEmailDescription', { email })}
                                    </p>
                                </div>
                                <Input 
                                    label={t('verificationCodeLabel')} 
                                    value={otp} 
                                    onChange={(e) => setOtp(e.target.value)} 
                                    placeholder={t('otpPlaceholder')}
                                    className="text-center text-2xl tracking-[12px] font-bold"
                                    maxLength={6}
                                    required 
                                />
                                <Button fullWidth loading={loading} type="submit" size="lg">
                                    {t('verifyButton')}
                                </Button>
                                <button 
                                    type="button" 
                                    onClick={() => setStep('email')}
                                    className="w-full text-sm text-gray-500 font-medium hover:text-brand-green transition-colors"
                                >
                                    {t('backButton')}
                                </button>
                            </form>
                        )}

                        {step === 'edit' && student && (
                            <form onSubmit={handleUpdate} className="space-y-6">
                                <div className="space-y-4">
                                    <Input 
                                        label={t('firstnameLabel')} 
                                        name="firstname" 
                                        value={student.firstname} 
                                        onChange={handleChange} 
                                        icon={<User size={16} />} 
                                        required 
                                    />
                                    <Input 
                                        label={t('othernameLabel')} 
                                        name="othername" 
                                        value={student.othername || ''} 
                                        onChange={handleChange} 
                                        icon={<User size={16} />} 
                                        required 
                                    />
                                    <Input 
                                        label={t('surnameLabel')} 
                                        name="surname" 
                                        value={student.surname} 
                                        onChange={handleChange} 
                                        icon={<User size={16} />} 
                                        required 
                                    />
                                    <Input 
                                        label={t('whatsappLabel')} 
                                        name="whatsapp" 
                                        value={student.whatsapp} 
                                        onChange={handleChange} 
                                        icon={<Phone size={16} />} 
                                        required 
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label={t('buildingNumberLabel')} name="buildingNumber" value={student.buildingNumber || ''} onChange={handleChange} required />
                                        <Input label={t('flatNumberLabel')} name="flatNumber" value={student.flatNumber || ''} onChange={handleChange} required />
                                    </div>
                                    <Input label={t('streetNameLabel')} name="streetName" value={student.streetName || ''} onChange={handleChange} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label={t('districtLabel')} name="district" value={student.district || ''} onChange={handleChange} required />
                                        <Input label={t('stateLabel')} name="state" value={student.state || ''} onChange={handleChange} required />
                                    </div>
                                    <Select 
                                        label={t('levelLabel')} 
                                        name="levelId" 
                                        value={student.levelId} 
                                        onChange={handleChange} 
                                        options={levels.map(l => ({ value: l.id, label: l.name }))} 
                                    />
                                </div>
                                <div className="pt-4 space-y-4">
                                    <Button fullWidth loading={loading} type="submit" size="lg">
                                        {t('updateButton')}
                                    </Button>
                                    <button 
                                        type="button" 
                                        onClick={() => navigate('/')}
                                        className="w-full text-sm text-gray-500 font-medium hover:text-brand-green transition-colors"
                                    >
                                        {t('cancel')}
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 'success' && (
                            <div className="text-center py-6">
                                <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="h-10 w-10 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('registrationSuccessTitle')}</h3>
                                <p className="text-gray-600 mb-8">
                                    {t('bookingUpdatedSuccess')}
                                </p>
                                <Button fullWidth onClick={() => navigate('/')} size="lg">
                                    {t('backToPortalButton')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageBookingPage;
