import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import { getAppSettings } from '../../services/apiService';
import { AppSettings } from '../../types';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getAppSettings();
        setAppSettings(settings);
      } catch (err) {
        console.error("Failed to fetch settings for countdown:", err);
      }
    };
    fetchSettings();
  }, []);

  const showMale = appSettings?.bookingStartTime && new Date(appSettings.bookingStartTime).getTime() > new Date().getTime();
  const showFemale = appSettings?.femaleBookingStartTime && new Date(appSettings.femaleBookingStartTime).getTime() > new Date().getTime();

  if (!showMale && !showFemale) return null;

  const isBoth = showMale && showFemale;

  return (
    <div className={isBoth ? "grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" : "flex justify-center mb-8 w-full"}>
      {showMale && (
        <div className={isBoth ? "w-full" : "w-full max-w-2xl"}>
          <SingleTimer 
            targetDateStr={appSettings!.bookingStartTime!} 
            title="Brothers Slot Booking Commences In" 
            isFemale={false}
          />
        </div>
      )}
      {showFemale && (
        <div className={isBoth ? "w-full" : "w-full max-w-2xl"}>
          <SingleTimer 
            targetDateStr={appSettings!.femaleBookingStartTime!} 
            title="Sisters Slot Booking Commences In" 
            isFemale={true}
          />
        </div>
      )}
    </div>
  );
};

const calculateTimeLeft = (targetDate: Date): TimeLeft | null => {
  const difference = targetDate.getTime() - new Date().getTime();
  if (difference <= 0) return null;

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

const SingleTimer: React.FC<{ targetDateStr: string; title: string; isFemale: boolean }> = ({ targetDateStr, title, isFemale }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calculateTimeLeft(new Date(targetDateStr)));

  useEffect(() => {
    const targetDate = new Date(targetDateStr);
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDateStr]);

  if (!timeLeft) return null;

  const targetDateObj = new Date(targetDateStr);
  const formattedTargetDate = targetDateObj.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cardBgClass = isFemale 
    ? 'bg-pink-50/70 border-pink-100' 
    : 'bg-brand-green/5 border-brand-green/10';
    
  const textTitleClass = isFemale ? 'text-pink-600' : 'text-brand-green';
  const iconBgClass = isFemale ? 'text-pink-200' : 'text-brand-green/30';
  const separatorClass = isFemale ? 'text-pink-300/40' : 'text-brand-green/30';
  const dateClass = isFemale ? 'text-pink-600/70' : 'text-brand-green/60';

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-2xl p-6 shadow-sm overflow-hidden relative ${cardBgClass}`}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-5 pointer-events-none ${iconBgClass}`}>
        <Clock size={120} />
      </div>
      
      <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
        <div className={`flex items-center space-x-2 font-semibold uppercase tracking-wider text-sm ${textTitleClass}`}>
          <Clock size={16} />
          <span>{title}</span>
        </div>
        
        <div className="flex space-x-3 md:space-x-4">
          <TimeUnit value={timeLeft.days} label="Days" isFemale={isFemale} />
          <div className={`text-3xl md:text-5xl font-light pt-1 ${separatorClass}`}>:</div>
          <TimeUnit value={timeLeft.hours} label="Hours" isFemale={isFemale} />
          <div className={`text-3xl md:text-5xl font-light pt-1 ${separatorClass}`}>:</div>
          <TimeUnit value={timeLeft.minutes} label="Minutes" isFemale={isFemale} />
          <div className={`text-3xl md:text-5xl font-light pt-1 ${separatorClass}`}>:</div>
          <TimeUnit value={timeLeft.seconds} label="Seconds" isFemale={isFemale} />
        </div>
        
        <p className={`text-xs font-medium italic text-center ${dateClass}`}>
          Official booking starts {formattedTargetDate}
        </p>
      </div>
    </motion.div>
  );
};

const TimeUnit: React.FC<{ value: number; label: string; isFemale: boolean }> = ({ value, label, isFemale }) => {
  const formattedValue = value.toString().padStart(2, '0');
  const unitBgClass = isFemale ? 'border-pink-100/60' : 'border-brand-green/5';
  const textClass = isFemale ? 'text-pink-600' : 'text-brand-green';
  const labelClass = isFemale ? 'text-pink-600/70' : 'text-brand-green/70';
  
  return (
    <div className="flex flex-col items-center">
      <div className={`bg-white shadow-inner rounded-xl w-14 h-16 md:w-16 md:h-20 flex items-center justify-center mb-1 border ${unitBgClass}`}>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={`text-2xl md:text-3xl font-bold font-mono ${textClass}`}
          >
            {formattedValue}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className={`text-[9px] md:text-xs font-bold uppercase tracking-widest ${labelClass}`}>
        {label}
      </span>
    </div>
  );
};

export default CountdownTimer;
