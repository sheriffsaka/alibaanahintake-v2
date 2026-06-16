import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Clock } from 'lucide-react';
import { getAppSettings } from '../../services/apiService';
import { AppSettings } from '../../types';

const ClosingBanner: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getAppSettings();
        setAppSettings(settings);
      } catch (err) {
        console.error("Failed to fetch settings for closing banner:", err);
      }
    };
    fetchSettings();
  }, []);

  const getIsActive = (endTimeStr?: string) => {
    if (!endTimeStr) return false;
    const endTime = new Date(endTimeStr);
    const now = new Date();
    const diffHours = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours < 48;
  };

  const showMaleBanner = getIsActive(appSettings?.bookingEndTime);
  const showFemaleBanner = getIsActive(appSettings?.femaleBookingEndTime);

  if (!showMaleBanner && !showFemaleBanner) return null;

  return (
    <div className="flex flex-col">
      {showMaleBanner && appSettings?.bookingEndTime && (
        <SingleBanner 
          endTimeStr={appSettings.bookingEndTime} 
          title="Brothers" 
          isFemale={false}
        />
      )}
      {showFemaleBanner && appSettings?.femaleBookingEndTime && (
        <SingleBanner 
          endTimeStr={appSettings.femaleBookingEndTime} 
          title="Sisters" 
          isFemale={true}
        />
      )}
    </div>
  );
};

const SingleBanner: React.FC<{ endTimeStr: string; title: string; isFemale: boolean }> = ({ endTimeStr, title, isFemale }) => {
  const endTime = new Date(endTimeStr);
  const formattedEnd = endTime.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const bgClass = isFemale 
    ? "bg-pink-50 border-b border-pink-200 text-pink-800" 
    : "bg-amber-50 border-b border-amber-200 text-amber-800";

  const pulseClass = isFemale ? "text-pink-600 animate-pulse" : "text-amber-600 animate-pulse";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={bgClass}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-center space-x-3">
        <AlertCircle size={20} className={`flex-shrink-0 ${pulseClass}`} />
        <p className="text-sm md:text-base font-medium text-center">
          <span className="font-bold">Attention ({title}):</span> Slot booking for this session is closing on <span className="underline">{formattedEnd}</span>. Book your slot now to avoid disappointment!
        </p>
        <Clock size={20} className="hidden md:block flex-shrink-0 opacity-80" />
      </div>
    </motion.div>
  );
};

export default ClosingBanner;
