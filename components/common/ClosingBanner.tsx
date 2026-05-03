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

  const getIsVisible = () => {
    if (!appSettings?.bookingEndTime) return false;

    const endTime = new Date(appSettings.bookingEndTime);
    const now = new Date();
    
    // Show banner if we are within 48 hours of ending, and it hasn't ended yet
    const diffHours = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return diffHours > 0 && diffHours < 48;
  };

  const isVisible = getIsVisible();

  if (!isVisible || !appSettings?.bookingEndTime) return null;

  const endTime = new Date(appSettings.bookingEndTime);
  const formattedEnd = endTime.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="bg-amber-50 border-b border-amber-200"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-center space-x-3 text-amber-800">
        <AlertCircle size={20} className="flex-shrink-0 animate-pulse" />
        <p className="text-sm md:text-base font-medium text-center">
          <span className="font-bold">Attention:</span> Slot booking for this session is closing on <span className="underline">{formattedEnd}</span>. Book your slot now to avoid disappointment!
        </p>
        <Clock size={20} className="hidden md:block flex-shrink-0" />
      </div>
    </motion.div>
  );
};

export default ClosingBanner;
