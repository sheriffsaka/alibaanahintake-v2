import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Target: May 1, 2026, 00:00:00 Cairo time (UTC+3)
// Cairo UTC+3: 2026-05-01T00:00:00+03:00 => 2026-04-30T21:00:00Z
const TARGET_DATE = new Date('2026-04-30T21:00:00Z');

const CountdownTimer: React.FC = () => {
  const calculateTimeLeft = useCallback((): TimeLeft | null => {
    const difference = TARGET_DATE.getTime() - new Date().getTime();
    
    if (difference <= 0) return null;

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }, []);

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  if (!timeLeft) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-green/10 border border-brand-green/20 rounded-2xl p-6 mb-8 shadow-sm overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Clock size={120} />
      </div>
      
      <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
        <div className="flex items-center space-x-2 text-brand-green font-semibold uppercase tracking-wider text-sm">
          <Clock size={16} />
          <span>Slot Booking Commences In</span>
        </div>
        
        <div className="flex space-x-3 md:space-x-6">
          <TimeUnit value={timeLeft.days} label="Days" />
          <div className="text-3xl md:text-5xl font-light text-brand-green/30 pt-1">:</div>
          <TimeUnit value={timeLeft.hours} label="Hours" />
          <div className="text-3xl md:text-5xl font-light text-brand-green/30 pt-1">:</div>
          <TimeUnit value={timeLeft.minutes} label="Minutes" />
          <div className="text-3xl md:text-5xl font-light text-brand-green/30 pt-1">:</div>
          <TimeUnit value={timeLeft.seconds} label="Seconds" />
        </div>
        
        <p className="text-xs text-brand-green/60 font-medium italic">
          Official booking starts Friday, May 1st, 12:00 AM (Cairo Time)
        </p>
      </div>
    </motion.div>
  );
};

const TimeUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const formattedValue = value.toString().padStart(2, '0');
  
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/80 backdrop-blur-sm shadow-inner rounded-xl w-14 h-16 md:w-20 md:h-24 flex items-center justify-center mb-2 border border-brand-green/5">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="text-3xl md:text-5xl font-bold font-mono text-brand-green"
          >
            {formattedValue}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-brand-green/70">
        {label}
      </span>
    </div>
  );
};

export default CountdownTimer;
